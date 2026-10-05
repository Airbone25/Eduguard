import { api } from "./client";
import type { Intervention } from "@/types/support";
export const interventionsApi = {
  list: (
    studentId: string,
    courseId: string,
    offset = 0,
    signal?: AbortSignal,
  ) =>
    api<Intervention[]>(
      `/teacher/students/${encodeURIComponent(studentId)}/interventions?course_offering_id=${encodeURIComponent(courseId)}&limit=100&offset=${offset}`,
      { signal },
    ),
};
