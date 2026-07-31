import { create } from "zustand";
import { api, User } from "./api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  accessToken: string | null;
  setAuth: (user: User, accessToken?: string) => void;
  setUser: (user: User) => void;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, isLoading: false, accessToken: accessToken ?? null }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => {
    api.logout().catch(() => {});
    set({ user: null, isLoading: false, accessToken: null });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
