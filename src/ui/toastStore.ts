import { create } from 'zustand';

interface ToastState {
  readonly message: string | null;
  readonly id: number;
  readonly show: (message: string) => void;
  readonly hide: () => void;
}

/** A short message at the bottom of the screen, e.g. "BOOST added to plots". */
export const useToast = create<ToastState>()((set) => ({
  message: null,
  id: 0,
  show: (message) => {
    set((s) => ({ message, id: s.id + 1 }));
  },
  hide: () => {
    set({ message: null });
  },
}));
