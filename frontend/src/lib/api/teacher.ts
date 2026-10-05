import { api, ApiError } from "./client";
import type {
  Course,
  RiskSummary,
  Student,
  StudentProgress,
  SummarySort,
} from "@/types/api";

async function allPages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; offset < 20000; offset += 200) {
    const page = await api<T[]>(
      `${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`,
      { signal },
    );
    result.push(...page);
    if (page.length < 200) return result;
  }
  throw new ApiError(
    0,
    "PAGE_LIMIT",
    "This list is too large to load. Please contact your school administrator.",
  );
}
export const teacherApi = {
  classes: (signal?: AbortSignal) =>
    allPages<Course>("/teacher/classes", signal),
  students: (courseId: string, signal?: AbortSignal) =>
    allPages<Student>(
      `/teacher/classes/${encodeURIComponent(courseId)}/students`,
      signal,
    ),
  student: (id: string, signal?: AbortSignal) =>
    api<Student>(`/teacher/students/${encodeURIComponent(id)}`, { signal }),
  progress: (id: string, courseId: string, signal?: AbortSignal) =>
    api<StudentProgress>(
      `/teacher/students/${encodeURIComponent(id)}/progress?course_offering_id=${encodeURIComponent(courseId)}`,
      { signal },
    ),
  summary: async (
    id: string,
    sort: SummarySort,
    signal?: AbortSignal,
  ): Promise<RiskSummary> => {
    const path = `/teacher/classes/${encodeURIComponent(id)}/risk-summary?sort=${sort}&limit=200`;
    const first = await api<RiskSummary>(`${path}&offset=0`, { signal });
    const students = [...first.students];
    // Load the entire roster before filtering/counting. Never label one page as the whole class.
    while (students.length < first.counts.students) {
      if (students.length >= 20000)
        throw new ApiError(0, "PAGE_LIMIT", "This class is too large to load.");
      const page = await api<RiskSummary>(
        `${path}&offset=${students.length}&as_of_date=${first.as_of_date}`,
        { signal },
      );
      if (
        !page.students.length ||
        page.counts.students !== first.counts.students
      )
        throw new ApiError(
          409,
          "ROSTER_CHANGED",
          "The class roster changed while loading. Please refresh.",
        );
      students.push(...page.students);
    }
    if (new Set(students.map((s) => s.student_id)).size !== students.length)
      throw new ApiError(
        409,
        "ROSTER_CHANGED",
        "The class roster changed while loading. Please refresh.",
      );
    return { ...first, students };
  },
};
