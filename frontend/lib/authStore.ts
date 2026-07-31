import { create } from "zustand";
import { api, User } from "./api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setAuth: (user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setAuth: (user) => set({ user, isLoading: false }),
  setUser: (user) => set({ user }),
  logout: () => {
    api.logout().catch(() => {});
    set({ user: null, isLoading: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
