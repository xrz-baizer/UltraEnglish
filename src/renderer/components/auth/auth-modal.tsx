import logo from '../../../../assets/icons/icon.png'
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Mail,
  Lock,
  User,
  AlertCircle,
  Check,
  Loader2,
  X,
  LogOut,
  RefreshCw
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { useAuthStore } from '@renderer/stores/auth-store'
import { cn } from '@renderer/lib/utils'

function LoginForm() {
  const { t } = useTranslation()
  const { login, setView, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError(t('auth.errors.fillAllFields'))
      return
    }

    const result = await login(email, password)
    if (!result.success) {
      setError(result.message || t('auth.errors.loginFailed'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <img src={logo} alt="UltraEnglish" className="mx-auto mb-4 h-16 w-16 object-contain" />
        <h2 className="text-xl font-semibold">{t('auth.welcomeBack')}</h2>

      </div>

      {/* Form */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="login-email" className="text-sm font-medium">
            {t('auth.email')}
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="glass-field w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm font-medium">
            {t('auth.password')}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="glass-field w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn('glass-primary',
            'flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all',
            isLoading ? 'cursor-not-allowed opacity-70' : 'hover:bg-primary-hover'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('auth.signingIn')}
            </>
          ) : (
            t('auth.signIn')
          )}
        </button>
      </form>

      {/* Switch to register */}
      <div className="text-center text-sm text-muted-foreground">
        {t('auth.noAccount')}{' '}
        <button
          onClick={() => setView('register')}
          className="font-medium text-primary-ink hover:text-primary-ink/80"
        >
          {t('nav.signUp')}
        </button>
      </div>
    </div>
  )
}

function RegisterForm() {
  const { t } = useTranslation()
  const { register, setView, isLoading } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

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

    const result = await register(name, email, password)
    if (!result.success) {
      setError(result.message || t('auth.errors.registerFailed'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <img src={logo} alt="UltraEnglish" className="mx-auto mb-4 h-16 w-16 object-contain" />
        <h2 className="text-xl font-semibold">{t('auth.createAccount')}</h2>

      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="register-name" className="text-sm font-medium">
            {t('auth.name')}
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              className="glass-field w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="register-email" className="text-sm font-medium">
            {t('auth.email')}
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="glass-field w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="register-password" className="text-sm font-medium">
            {t('auth.password')}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="glass-field w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          {password.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              {passwordStrength.hasMinLength ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground" />
              )}
              <span
                className={passwordStrength.hasMinLength ? 'text-success' : 'text-muted-foreground'}
              >
                {t('auth.passwordHint')}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label htmlFor="register-confirm" className="text-sm font-medium">
            {t('auth.confirmPassword')}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="register-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              className="glass-field w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          {confirmPassword.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              {passwordStrength.hasMatch ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <AlertCircle className="h-3 w-3 text-destructive" />
              )}
              <span className={passwordStrength.hasMatch ? 'text-success' : 'text-destructive'}>
                {passwordStrength.hasMatch
                  ? t('auth.passwordHint')
                  : t('auth.errors.passwordMismatch')}
              </span>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn('glass-primary',
            'flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all',
            isLoading ? 'cursor-not-allowed opacity-70' : 'hover:bg-primary-hover'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('auth.signingUp')}
            </>
          ) : (
            t('auth.signUp')
          )}
        </button>
      </form>

      {/* Switch to login */}
      <div className="text-center text-sm text-muted-foreground">
        {t('auth.hasAccount')}{' '}
        <button
          onClick={() => setView('login')}
          className="font-medium text-primary-ink hover:text-primary-ink/80"
        >
          {t('nav.signIn')}
        </button>
      </div>
    </div>
  )
}

function UserProfile() {
  const { t } = useTranslation()
  const { user, logout, switchAccount, setOpen } = useAuthStore()

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-4 ring-background">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <User className="h-10 w-10 text-primary-ink/50" />
          )}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">{user.name}</h3>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => {
            switchAccount()
          }}
          className="glass-control flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all "
        >
          <RefreshCw className="h-4 w-4" />
          {t('auth.switchAccount')}
        </button>
        <button
          onClick={() => {
            logout()
            setOpen(false)
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 py-2.5 text-sm font-medium text-destructive transition-all hover:bg-destructive/20"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.signOut')}
        </button>
      </div>
    </div>
  )
}

export function AuthModal() {
  const { t } = useTranslation()
  const { isOpen, setOpen, view, isAuthenticated } = useAuthStore()

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-[400px] gap-0 overflow-hidden p-0 sm:rounded-2xl" hideCloseButton>
        <DialogTitle className="sr-only">
          {isAuthenticated ? t('settings.categories.user') : view === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
        </DialogTitle>
        <div className="relative">
          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="glass-control absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            {isAuthenticated ? (
              <UserProfile />
            ) : view === 'login' ? (
              <LoginForm />
            ) : (
              <RegisterForm />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
