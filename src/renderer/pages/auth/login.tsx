import logo from '../../../../assets/icons/icon.png'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, Mail, Lock, AlertCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError(t('auth.errors.fillAllFields'))
      return
    }

    setLoading(true)
    try {
      const result = await window.electronAPI.login(email, password)
      if (result.success) {
        navigate('/')
      } else {
        setError(result.message || t('auth.errors.loginFailed'))
      }
    } catch (err) {
      setError(t('auth.errors.generalError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Primary gradient orb */}
        <div
          className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
            animation: 'float 8s ease-in-out infinite'
          }}
        />
        {/* Secondary gradient orb */}
        <div
          className="absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
            animation: 'float 10s ease-in-out infinite reverse'
          }}
        />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Back button */}
      <div className="relative z-10 p-6">
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 transition-all duration-300 group-hover:-translate-x-1 group-hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {t('common.back')}
          </span>
        </button>
      </div>

      {/* Login form container */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-12">
        <div
          className="w-full max-w-[400px] animate-fade-in-up"
          style={{ animationDuration: '0.6s' }}
        >
          {/* Glass card */}
          <div className="glass-card rounded-2xl p-8 shadow-2xl shadow-primary/5">
            {/* Logo and header */}
            <div className="mb-8 text-center">
              <img src={logo} alt="UltraEnglish" className="mx-auto mb-4 h-16 w-16 object-contain" />
              <h1
                className="text-2xl font-semibold tracking-tight text-foreground"
              >
                {t('auth.welcomeBack')}
              </h1>

            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error message */}
              {error && (
                <div
                  className="flex items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in-scale"
                  style={{ animationDuration: '0.3s' }}
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email field */}
              <div
                className="space-y-2"
              >
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <div
                    className={cn(
                      'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200',
                      focusedField === 'email' ? 'text-primary-ink' : 'text-muted-foreground'
                    )}
                  >
                    <Mail className="h-[18px] w-[18px]" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder={t('auth.emailPlaceholder')}
                    className={cn('glass-field',
                      'w-full rounded-xl border py-3.5 pl-12 pr-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring transition-all duration-200',
                      'placeholder:text-muted-foreground',
                      focusedField === 'email'
                        ? 'border-primary/50 ring-4 ring-primary/10'
                        : ' '
                    )}
                  />
                </div>
              </div>

              {/* Password field */}
              <div
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    {t('auth.password')}
                  </label>
                  <NavLink
                    to="/forgot-password"
                    className="text-xs font-medium text-primary-ink transition-colors hover:text-primary-ink/80"
                  >
                    {t('auth.forgotPassword')}
                  </NavLink>
                </div>
                <div className="relative">
                  <div
                    className={cn(
                      'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200',
                      focusedField === 'password' ? 'text-primary-ink' : 'text-muted-foreground'
                    )}
                  >
                    <Lock className="h-[18px] w-[18px]" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className={cn('glass-field',
                      'w-full rounded-xl border py-3.5 pl-12 pr-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring transition-all duration-200',
                      'placeholder:text-muted-foreground',
                      focusedField === 'password'
                        ? 'border-primary/50 ring-4 ring-primary/10'
                        : ' '
                    )}
                  />
                </div>
              </div>

              {/* Submit button */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn('glass-primary',
                    'btn-shine relative flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300',
                    loading
                      ? 'cursor-not-allowed opacity-70'
                      : 'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0'
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('auth.signingIn')}
                    </>
                  ) : (
                    t('auth.signIn')
                  )}
                </button>
              </div>
            </form>

            {/* Sign up link */}
            <div
              className="mt-8 text-center text-sm text-muted-foreground"
            >
              {t('auth.noAccount')}{' '}
              <NavLink
                to="/register"
                className="font-medium text-primary-ink transition-colors hover:text-primary-ink/80"
              >
                {t('nav.signUp')}
              </NavLink>
            </div>
          </div>

          {/* Decorative element */}
          <div className="mt-8 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary/20"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
