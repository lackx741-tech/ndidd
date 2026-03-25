import { create } from 'zustand';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
interface AppState {
  selectedChainId: number;
  notifications: Notification[];
  setChainId: (id: number) => void;
  addNotification: (n: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedChainId: 1,
  notifications: [],
  setChainId: (selectedChainId) => set({ selectedChainId }),
  addNotification: (n) =>
    set((s) => ({
      notifications: [...s.notifications, { ...n, id: Math.random().toString(36).slice(2) }],
    })),
  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) })),
}));
