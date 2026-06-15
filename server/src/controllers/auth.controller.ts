import { Request, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  verifyPassword,
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from '../services/auth.service';
import { audit } from '../services/audit.service';
import { AuthRequest } from '../types';
import { LoginSchema, ChangePasswordSchema } from '../schemas/auth.schemas';

// ─── Cognito Config ───────────────────────────────────────────────────────────

export const getConfig = (_req: Request, res: Response): void => {
  const userPoolId = process.env.COGNITO_USER_POOL_ID
  const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID
  const region = process.env.AWS_REGION ?? 'us-east-1'

  if (userPoolId && clientId) {
    res.json({ success: true, data: { userPoolId, clientId, region } })
  } else {
    res.json({ success: true, data: null })
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: body.error.flatten() });
      return;
    }

    const { email, password } = body.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, error: 'Account is deactivated' });
      return;
    }

    const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await storeRefreshToken(user.id, refreshToken);

    audit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  } catch (err) {
    console.error('[auth.login]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    if (!token) {
      res.status(400).json({ success: false, error: 'refreshToken is required' });
      return;
    }

    // Verify JWT signature and expiry
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    // Check the token exists in DB (not yet revoked)
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored) {
      res.status(401).json({ success: false, error: 'Refresh token has been revoked' });
      return;
    }

    // Check user is still active
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      res.status(403).json({ success: false, error: 'Account is deactivated' });
      return;
    }

    // Rotate: revoke old token, issue new pair
    await revokeRefreshToken(token);

    const newPayload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    await storeRefreshToken(user.id, newRefreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    console.error('[auth.refreshToken]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    if (!token) {
      res.status(400).json({ success: false, error: 'refreshToken is required' });
      return;
    }

    await revokeRefreshToken(token);

    // Token was already revoked above; attempt to find the user id from the JWT directly
    let userId: string | undefined;
    try {
      const payload = verifyRefreshToken(token);
      userId = payload.sub;
    } catch {
      // token may already be expired — skip audit user id
    }

    if (userId) {
      audit({
        userId,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    console.error('[auth.logout]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('[auth.getMe]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ─── Change Password ──────────────────────────────────────────────────────────

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = ChangePasswordSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: body.error.flatten() });
      return;
    }

    const { currentPassword, newPassword } = body.data;

    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const currentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentValid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens — force re-login on all devices
    await revokeAllUserTokens(user.id);

    audit({
      userId: user.id,
      action: 'CHANGE_PASSWORD',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ success: true, data: { message: 'Password changed successfully. Please log in again.' } });
  } catch (err) {
    console.error('[auth.changePassword]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
