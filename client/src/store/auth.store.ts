import { create } from 'zustand'
import type { User } from '../types'

const REFRESH_TOKEN_KEY = 'sf_refresh_token'

interface AuthState {
  user: User | null
  accessToken: string | null        // local JWT access token OR Cognito ID token (sent as Bearer)
  refreshToken: string | null
  cognitoAccessToken: string | null // Cognito access token — only for GlobalSignOut / ChangePassword
  pendingChallenge: { session: string; email: string } | null
  isAuthenticated: boolean
}

interface AuthActions {
  setAuth: (user: User, accessToken: string, refreshToken: string, cognitoAccessToken?: string) => void
  setAccessToken: (token: string) => void
  setPendingChallenge: (challenge: { session: string; email: string } | null) => void
  logout: () => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  cognitoAccessToken: null,
  pendingChallenge: null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken, cognitoAccessToken) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    set({
      user,
      accessToken,
      refreshToken,
      cognitoAccessToken: cognitoAccessToken ?? null,
      pendingChallenge: null,
      isAuthenticated: true,
    })
  },

  setAccessToken: (token) => set({ accessToken: token }),

  setPendingChallenge: (challenge) => set({ pendingChallenge: challenge }),

  logout: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      cognitoAccessToken: null,
      pendingChallenge: null,
      isAuthenticated: false,
    })
  },

  loadFromStorage: () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (refreshToken) set({ refreshToken })
  },
}))

export const getAccessToken = (): string | null => useAuthStore.getState().accessToken
export const getRefreshToken = (): string | null => useAuthStore.getState().refreshToken
export const getCognitoAccessToken = (): string | null => useAuthStore.getState().cognitoAccessToken
