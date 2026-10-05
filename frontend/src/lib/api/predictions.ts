import { api } from "./client";
import type { Prediction } from "@/types/support";
export const predictionsApi = {
  list: (
    studentId: string,
    courseId: string,
    offset = 0,
    signal?: AbortSignal,
  ) =>
    api<Prediction[]>(
      `/teacher/students/${encodeURIComponent(studentId)}/predictions?course_offering_id=${encodeURIComponent(courseId)}&limit=100&offset=${offset}`,
      { signal },
    ),
};
