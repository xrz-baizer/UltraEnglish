import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  avatar?: string | null
}

type AuthResult = {
  success: boolean
  message?: string
  user?: User
}

type CurrentUserResult = {
  user?: User | null
} | null

type AuthView = 'login' | 'register'

interface AuthState {
  // Modal state
  isOpen: boolean
  view: AuthView
  setOpen: (open: boolean) => void
  setView: (view: AuthView) => void

  // User state
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  switchAccount: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // Modal state
  isOpen: false,
  view: 'login',
  setOpen: (open) => set({ isOpen: open }),
  setView: (view) => set({ view }),

  // User state
  user: null,
  isAuthenticated: false,
  isLoading: false,

  // Actions
  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const result = (await window.electronAPI.login(email, password)) as AuthResult
      if (result.success && result.user) {
        set({
          user: result.user as User,
          isAuthenticated: true,
          isOpen: false
        })
        return { success: true }
      }
      return { success: false, message: result.message }
    } catch (error) {
      return { success: false, message: 'Login failed' }
    } finally {
      set({ isLoading: false })
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true })
    try {
      const result = await window.electronAPI.register(name, email, password)
      if (result.success) {
        // After registration, switch to login view
        set({ view: 'login' })
        return { success: true }
      }
      return { success: false, message: result.message }
    } catch (error) {
      return { success: false, message: 'Registration failed' }
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    try {
      await window.electronAPI.logout?.()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      set({ user: null, isAuthenticated: false })
    }
  },

  checkAuth: async () => {
    try {
      const result = (await window.electronAPI.getCurrentUser?.()) as CurrentUserResult
      if (result?.user) {
        set({ user: result.user as User, isAuthenticated: true })
      }
    } catch (error) {
      console.error('Check auth error:', error)
    }
  },

  switchAccount: () => {
    set({ user: null, isAuthenticated: false, isOpen: true, view: 'login' })
  }
}))
