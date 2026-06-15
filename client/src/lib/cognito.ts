export interface CognitoConfig {
  userPoolId: string
  clientId: string
  region: string
}

export interface CognitoAuthResult {
  accessToken: string  // Cognito access token — needed for GlobalSignOut / ChangePassword
  idToken: string      // Cognito ID token — sent as Bearer to our API
  refreshToken: string
}

let config: CognitoConfig | null = null
let configLoaded = false

export async function loadCognitoConfig(): Promise<CognitoConfig | null> {
  if (configLoaded) return config
  try {
    const res = await fetch('/api/auth/config')
    const body = await res.json() as { data: CognitoConfig | null }
    config = body?.data ?? null
  } catch {
    config = null
  }
  configLoaded = true
  return config
}

export function getCognitoConfig(): CognitoConfig | null {
  return config
}

export function isCognitoEnabled(): boolean {
  return !!config
}

// ─── Private helpers ──────────────────────────────────────────────────────────

class CognitoError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = code
  }
}

async function post(target: string, body: unknown): Promise<Record<string, unknown>> {
  if (!config) throw new Error('Cognito is not configured')
  const res = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json() as Record<string, unknown>
  if (!res.ok) {
    throw new CognitoError(
      (data['__type'] as string) ?? 'UnknownError',
      (data['message'] as string) ?? 'Cognito error',
    )
  }
  return data
}

function extractTokens(data: Record<string, unknown>): CognitoAuthResult {
  const ar = data['AuthenticationResult'] as Record<string, string>
  return {
    accessToken: ar['AccessToken'],
    idToken: ar['IdToken'],
    refreshToken: ar['RefreshToken'],
  }
}

// ─── Public auth functions ────────────────────────────────────────────────────

export type SignInResult =
  | { type: 'success'; tokens: CognitoAuthResult }
  | { type: 'NEW_PASSWORD_REQUIRED'; session: string; email: string }

export async function cognitoSignIn(email: string, password: string): Promise<SignInResult> {
  if (!config) throw new Error('Cognito is not configured')
  const data = await post('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.clientId,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  })

  if (data['ChallengeName'] === 'NEW_PASSWORD_REQUIRED') {
    return { type: 'NEW_PASSWORD_REQUIRED', session: data['Session'] as string, email }
  }
  return { type: 'success', tokens: extractTokens(data) }
}

export async function cognitoCompleteNewPassword(
  email: string,
  newPassword: string,
  session: string,
): Promise<CognitoAuthResult> {
  if (!config) throw new Error('Cognito is not configured')
  const data = await post('RespondToAuthChallenge', {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    ClientId: config.clientId,
    Session: session,
    ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword },
  })
  return extractTokens(data)
}

export async function cognitoRefresh(
  refreshToken: string,
): Promise<{ idToken: string; accessToken: string }> {
  if (!config) throw new Error('Cognito is not configured')
  const data = await post('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: config.clientId,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  })
  const ar = data['AuthenticationResult'] as Record<string, string>
  return { idToken: ar['IdToken'], accessToken: ar['AccessToken'] }
}

export async function cognitoSignOut(accessToken: string): Promise<void> {
  try {
    await post('GlobalSignOut', { AccessToken: accessToken })
  } catch {
    // best-effort — token may already be invalid
  }
}
