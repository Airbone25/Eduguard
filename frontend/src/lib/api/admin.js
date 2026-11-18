import { api } from "./client";
import { allPages } from "./pagination";

export const adminApi = {
  catalog: async (signal) => {
    const [teachers, students, classes, subjects, courses] = await Promise.all([
      allPages("/admin/teachers", signal),
      allPages("/admin/students", signal),
      allPages("/admin/classes", signal),
      allPages("/admin/subjects", signal),
      allPages("/admin/course-offerings", signal),
    ]);
    return { teachers, students, classes, subjects, courses };
  },
  write: (path, body, method = "POST") =>
    api(`/admin/${path}`, { method, body: JSON.stringify(body) }),
  imports: (signal) => allPages("/admin/imports", signal),
  school: (signal) => api("/admin/settings", { signal }),
  members: async (course, signal) => {
    const [teachers, students] = await Promise.all([
      allPages(`/admin/course-offerings/${course}/teachers`, signal),
      allPages(`/admin/course-offerings/${course}/students`, signal),
    ]);
    return { teachers, students };
  },
  unassign: (course, teacher) =>
    api(`/admin/course-offerings/${course}/teachers/${teacher}`, {
      method: "DELETE",
    }),
  importFile: (kind, file, context, dryRun) => {
    const body = new FormData();
    body.append("file", file);
    body.append("dry_run", String(dryRun));
    body.append(
      kind === "students" ? "academic_year" : "course_offering_id",
      context,
    );
    return api(`/admin/imports/${kind}`, {
      method: "POST",
      body,
    });
  },
};

export const adminCourseLabel = (id, data) => {
  if (!data?.courses) return "Course";
  const c = data.courses.find((x) => x.id === id);
  if (!c) return "Course unavailable";
  const className = data.classes?.find((r) => r.id === c.classroom_id)?.name || "Class";
  const subjectName = data.subjects?.find((r) => r.id === c.subject_id)?.name || "Subject";
  return `${className} · ${subjectName} (${c.academic_year || ""})`;
};
