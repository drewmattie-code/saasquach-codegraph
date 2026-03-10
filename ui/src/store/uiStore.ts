import { create } from 'zustand'

type ToastLevel = 'success' | 'error' | 'warning'

interface ToastItem {
  id: number
  message: string
  level: ToastLevel
}

interface UIState {
  toasts: ToastItem[]
  pushToast: (message: string, level?: ToastLevel) => void
  removeToast: (id: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  pushToast: (message, level = 'success') =>
    set((state) => ({
      toasts: [...state.toasts, { id: Date.now() + Math.floor(Math.random() * 1000), message, level }],
    })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
