import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { authApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'

const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof LoginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(LoginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    try {
      const res = await authApi.login(data.email, data.password)
      if (res.success) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken)
        navigate('/dashboard', { replace: true })
      } else {
        setServerError(res.error ?? 'Login failed')
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Invalid credentials. Please try again.'
      setServerError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-primary-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <img
            src="/logo.jpg"
            alt="Riverdale Academy"
            className="w-24 h-24 rounded-full object-cover mx-auto mb-4 shadow-lg border-4 border-white/20"
          />
          <h1 className="text-3xl font-bold text-white">Riverdale Academy</h1>
          <p className="text-primary-200 mt-1 text-sm italic">Dream it, Believe it, Achieve it</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>

          {serverError && (
            <div className="mb-4 rounded-lg bg-danger-50 border border-danger-200 p-3 text-sm text-danger-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@school.edu"
                {...register('email')}
                className="input"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger-600">{errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-primary-200 text-xs mt-6">
          Contact your system administrator if you need access.
        </p>
      </div>
    </div>
  )
}
