import { api } from "./client";
import type { StudentDashboard, VisibleIntervention } from "@/types/support";
import type { StudentProgress } from "@/types/api";
// Separate safe response types keep internal predictions out of student-facing consumers.
export const studentApi = {
  dashboard: (signal?: AbortSignal) =>
    api<StudentDashboard>("/student/me/dashboard", { signal }),
  progress: (signal?: AbortSignal) =>
    api<StudentProgress>("/student/me/progress", { signal }),
  interventions: (offset = 0, signal?: AbortSignal) =>
    api<VisibleIntervention[]>(
      `/student/me/interventions?limit=100&offset=${offset}`,
      { signal },
    ),
};
