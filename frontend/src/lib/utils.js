import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const roleLabel = {
  school_admin: "School Administrator",
  teacher: "Teacher",
  student: "Student",
};

export const roleHome = {
  school_admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/dashboard",
};

export function courseLabel(course) {
  if (!course) return "Course";
  const classroom = course.classroom_name || course.classroom?.name || "Class";
  const subject = course.subject_name || course.subject?.name || "Subject";
  const year = course.academic_year || "";
  return year ? `${classroom} · ${subject} (${year})` : `${classroom} · ${subject}`;
}

export function dateLabel(dateStr) {
  if (!dateStr) return "—";
  try {
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

export function percent(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `${Math.round(val)}%`;
}
