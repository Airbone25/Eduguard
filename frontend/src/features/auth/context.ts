import { createContext, useContext } from "react";
import type { LoginInput, User } from "@/types/api";
export interface AuthState {
  user: User | null;
  pending: boolean;
  error: Error | null;
  logoutWarning: string | null;
  signIn: (input: LoginInput) => Promise<User>;
  signOut: () => Promise<void>;
  retry: () => void;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
