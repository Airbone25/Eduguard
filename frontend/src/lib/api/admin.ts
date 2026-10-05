import { api } from "./client";
import type { User } from "@/types/api";
// Typed read adapters for later milestones; no admin requests run in placeholder pages.
export const adminApi = {
  users: (offset = 0, signal?: AbortSignal) =>
    api<User[]>(`/admin/users?limit=100&offset=${offset}`, { signal }),
};
