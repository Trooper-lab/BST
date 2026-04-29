import { create } from 'zustand';

interface AuthState {
  user: any | null;
  profile: any | null;
  activeRoute: any | null;
  setUser: (user: any | null) => void;
  setProfile: (profile: any | null) => void;
  setActiveRoute: (route: any | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  activeRoute: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  isLoading: true,
  setIsLoading: (isLoading) => set({ isLoading }),
}));
