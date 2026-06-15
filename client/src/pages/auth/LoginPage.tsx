import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
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
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please try again.'
      setServerError(msg)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-12">
        {/* decorative blobs */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 right-8 h-48 w-48 rounded-full bg-brand-600/30" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <div className="mb-8 relative">
            <div className="absolute inset-0 rounded-3xl bg-white/10 blur-xl scale-110" />
            <img
              src="/logo.jpg"
              alt="Riverdale Academy"
              className="relative w-32 h-32 rounded-3xl object-cover shadow-2xl ring-2 ring-white/20"
            />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Riverdale<br />Academy
          </h1>
          <p className="mt-3 text-base text-white/60 italic font-medium tracking-wide">
            Dream it · Believe it · Achieve it
          </p>

          <div className="mt-12 w-full space-y-4">
            {[
              { icon: '🔐', label: 'Strict separation of duties' },
              { icon: '📊', label: 'Real-time cash flow insights' },
              { icon: '📋', label: 'Immutable audit trail' },
              { icon: '💱', label: 'Multi-currency support' },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-xl bg-white/8 border border-white/10 px-4 py-3 text-left"
              >
                <span className="text-lg">{f.icon}</span>
                <span className="text-sm font-medium text-white/80">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-slate-50 px-6 py-12">
        {/* Mobile logo */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <img
            src="/logo.jpg"
            alt="Riverdale Academy"
            className="w-20 h-20 rounded-2xl object-cover shadow-lg mb-3"
          />
          <h2 className="text-xl font-bold text-slate-900">Riverdale Academy</h2>
          <p className="text-sm text-slate-500 italic">Dream it · Believe it · Achieve it</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to the Finance System</p>
          </div>

          {serverError && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              <span className="text-red-500 mt-0.5">⚠</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@school.edu"
                {...register('email')}
                className="input"
              />
              {errors.email && (
                <p className="form-error">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base mt-2"
            >
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

          <div className="mt-8 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-slate-500">
              All transactions require dual approval for maximum security.
            </p>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            Contact your system administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  )
}
