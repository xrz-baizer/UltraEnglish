import logo from '../../../../assets/icons/icon.png'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, Mail, Lock, User, AlertCircle, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const passwordStrength = {
    hasMinLength: password.length >= 8,
    hasMatch: password === confirmPassword && confirmPassword.length > 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name || !email || !password || !confirmPassword) {
      setError(t('auth.errors.fillAllFields'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.errors.passwordMismatch'))
      return
    }

    if (password.length < 8) {
      setError(t('auth.errors.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      const result = await window.electronAPI.register(name, email, password)
      if (result.success) {
        navigate('/login')
      } else {
        setError(result.message || t('auth.errors.registerFailed'))
      }
    } catch (err) {
      setError(t('auth.errors.generalError'))
    } finally {
      setLoading(false)
    }
  }

  const InputField = ({
    id,
    type,
    value,
    onChange,
    placeholder,
    label,
    icon: Icon,
    hint
  }: {
    id: string
    type: string
    value: string
    onChange: (value: string) => void
    placeholder: string
    label: string
    icon: typeof Mail
    hint?: React.ReactNode
  }) => (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <div
          className={cn(
            'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200',
            focusedField === id ? 'text-primary-ink' : 'text-muted-foreground'
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocusedField(id)}
          onBlur={() => setFocusedField(null)}
          placeholder={placeholder}
          className={cn('glass-field',
            'w-full rounded-xl border py-3.5 pl-12 pr-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring transition-all duration-200',
            'placeholder:text-muted-foreground',
            focusedField === id
              ? 'border-primary/50 ring-4 ring-primary/10'
              : ' '
          )}
        />
      </div>
      {hint}
    </div>
  )

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Primary gradient orb */}
        <div
          className="absolute -right-1/4 -top-1/4 h-[600px] w-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
            animation: 'float 8s ease-in-out infinite'
          }}
        />
        {/* Secondary gradient orb */}
        <div
          className="absolute -bottom-1/4 -left-1/4 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
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

      {/* Register form container */}
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
                {t('auth.createAccount')}
              </h1>

            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {/* Name field */}
              <div>
                <InputField
                  id="name"
                  type="text"
                  value={name}
                  onChange={setName}
                  placeholder={t('auth.namePlaceholder')}
                  label={t('auth.name')}
                  icon={User}
                />
              </div>

              {/* Email field */}
              <div>
                <InputField
                  id="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  label={t('auth.email')}
                  icon={Mail}
                />
              </div>

              {/* Password field */}
              <div>
                <InputField
                  id="password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  label={t('auth.password')}
                  icon={Lock}
                  hint={
                    password.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <div
                          className={cn(
                            'flex items-center gap-1 transition-colors',
                            passwordStrength.hasMinLength
                              ? 'text-success'
                              : 'text-muted-foreground'
                          )}
                        >
                          {passwordStrength.hasMinLength ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-current" />
                          )}
                          <span>{t('auth.passwordHint')}</span>
                        </div>
                      </div>
                    )
                  }
                />
              </div>

              {/* Confirm Password field */}
              <div>
                <InputField
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  label={t('auth.confirmPassword')}
                  icon={Lock}
                  hint={
                    confirmPassword.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <div
                          className={cn(
                            'flex items-center gap-1 transition-colors',
                            passwordStrength.hasMatch
                              ? 'text-success'
                              : 'text-destructive'
                          )}
                        >
                          {passwordStrength.hasMatch ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          <span>
                            {passwordStrength.hasMatch
                              ? t('auth.passwordHint')
                              : t('auth.errors.passwordMismatch')}
                          </span>
                        </div>
                      </div>
                    )
                  }
                />
              </div>

              {/* Submit button */}
              <div
                className="pt-2"
              >
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
                      {t('auth.signingUp')}
                    </>
                  ) : (
                    t('auth.signUp')
                  )}
                </button>
              </div>
            </form>

            {/* Sign in link */}
            <div
              className="mt-8 text-center text-sm text-muted-foreground"
            >
              {t('auth.hasAccount')}{' '}
              <NavLink
                to="/login"
                className="font-medium text-primary-ink transition-colors hover:text-primary-ink/80"
              >
                {t('nav.signIn')}
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
