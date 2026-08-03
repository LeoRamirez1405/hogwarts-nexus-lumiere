import { create } from "zustand";
import { api, FeatureFlag } from "./api";

interface FeatureFlagState {
  flags: Record<string, FeatureFlag>;
  loaded: boolean;
  load: () => Promise<void>;
  setFlag: (flag: FeatureFlag) => void;
  isEnabled: (key: string) => boolean;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  flags: {},
  loaded: false,
  load: async () => {
    try {
      const { items } = await api.getFeatureFlags();
      const map: Record<string, FeatureFlag> = {};
      for (const f of items) map[f.key] = f;
      set({ flags: map, loaded: true });
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      set({ loaded: true });
    }
  },
  setFlag: (flag) =>
    set((state) => ({ flags: { ...state.flags, [flag.key]: flag } })),
  isEnabled: (key) => get().flags[key]?.enabled ?? false,
}));

export function useFeatureFlag(key: string): boolean {
  return useFeatureFlagStore((s) => s.flags[key]?.enabled ?? false);
}