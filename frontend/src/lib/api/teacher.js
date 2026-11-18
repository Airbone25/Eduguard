import { api, ApiError } from "./client";
import { allPages } from "./pagination";

export const teacherApi = {
  classes: (signal) => allPages("/teacher/classes", signal),
  students: (courseId, signal) =>
    allPages(`/teacher/classes/${encodeURIComponent(courseId)}/students`, signal),
  student: (id, signal) =>
    api(`/teacher/students/${encodeURIComponent(id)}`, { signal }),
  progress: (id, courseId, signal) =>
    api(
      `/teacher/students/${encodeURIComponent(id)}/progress?course_offering_id=${encodeURIComponent(courseId)}`,
      { signal },
    ),
  summary: async (id, sort = "attention", signal) => {
    const path = `/teacher/classes/${encodeURIComponent(id)}/risk-summary?sort=${sort}&limit=200`;
    const first = await api(`${path}&offset=0`, { signal });
    return first;
  },
};
