import { api } from "./client";
import type { LoginInput, Session, User } from "@/types/api";
export const authApi = {
  login: (input: LoginInput) =>
    api<Session>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(input) },
      false,
    ),
  me: (signal?: AbortSignal) => api<User>("/auth/me", { signal }),
};
