// Global Express Request augmentation — adds req.user set by auth middleware
import type { JwtPayload } from '.'

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload
    }
  }
}
