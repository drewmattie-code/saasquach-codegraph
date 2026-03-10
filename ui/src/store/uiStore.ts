import { create } from 'zustand'

interface UIState {
  toast: string | null
  setToast: (value: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  setToast: (value) => set({ toast: value }),
}))
