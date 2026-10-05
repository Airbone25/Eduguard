import { useQuery } from "@tanstack/react-query";
import { allPages } from "@/lib/api/pagination";
import { api } from "@/lib/api/client";
import type { Course, Student, User } from "@/types/api";
export interface Teacher {
  id: string;
  user_id: string;
  employee_code: string | null;
  user: User;
}
export interface Classroom {
  id: string;
  name: string;
  grade_label: string;
  academic_year: string;
  is_active: boolean;
}
export interface Subject {
  id: string;
  name: string;
  code: string;
}
export interface Assignment {
  teacher_id: string;
  is_primary: boolean;
}
export interface Enrollment {
  id: string;
  student_id: string;
  status: "active" | "withdrawn" | "completed";
  enrolled_at: string;
}
export interface ImportReport {
  id: string;
  filename: string;
  import_type: string;
  status: string;
  rows_total: number;
  rows_succeeded: number;
  rows_failed: number;
  created_at: string;
  errors: {
    row_number: number;
    field: string;
    code: string;
    message: string;
  }[];
  initial_credentials?: { email: string; initial_password: string }[];
}
export interface School {
  name: string;
  slug: string;
  domain: string | null;
}
export const adminApi = {
  catalog: async (signal?: AbortSignal) => {
    const [teachers, students, classes, subjects, courses] = await Promise.all([
      allPages<Teacher>("/admin/teachers", signal),
      allPages<Student>("/admin/students", signal),
      allPages<Classroom>("/admin/classes", signal),
      allPages<Subject>("/admin/subjects", signal),
      allPages<Course>("/admin/course-offerings", signal),
    ]);
    return { teachers, students, classes, subjects, courses };
  },
  write: <T = unknown>(path: string, body: unknown, method = "POST") =>
    api<T>(`/admin/${path}`, { method, body: JSON.stringify(body) }),
  imports: (signal?: AbortSignal) =>
    allPages<ImportReport>("/admin/imports", signal),
  school: (signal?: AbortSignal) => api<School>("/admin/settings", { signal }),
  members: async (course: string, signal?: AbortSignal) => {
    const [teachers, students] = await Promise.all([
      allPages<Assignment>(
        `/admin/course-offerings/${course}/teachers`,
        signal,
      ),
      allPages<Enrollment>(
        `/admin/course-offerings/${course}/students`,
        signal,
      ),
    ]);
    return { teachers, students };
  },
  unassign: (course: string, teacher: string) =>
    api<void>(`/admin/course-offerings/${course}/teachers/${teacher}`, {
      method: "DELETE",
    }),
  importFile: (kind: string, file: File, context: string, dryRun: boolean) => {
    const body = new FormData();
    body.append("file", file);
    body.append("dry_run", String(dryRun));
    body.append(
      kind === "students" ? "academic_year" : "course_offering_id",
      context,
    );
    return api<ImportReport>(`/admin/imports/${kind}`, {
      method: "POST",
      body,
    });
  },
};
export const useCatalog = () =>
  useQuery({
    queryKey: ["admin", "catalog"],
    queryFn: ({ signal }) => adminApi.catalog(signal),
  });
export type Catalog = Awaited<ReturnType<typeof adminApi.catalog>>;
export const adminCourseLabel = (id: string, data: Catalog) => {
  const c = data.courses.find((c) => c.id === id);
  return c
    ? `${data.classes.find((r) => r.id === c.classroom_id)?.name ?? "Class"} · ${data.subjects.find((r) => r.id === c.subject_id)?.name ?? "Subject"} · ${c.academic_year}`
    : "Course unavailable";
};
