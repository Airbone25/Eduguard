import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Course, Role } from "@/types/api";

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
export const percent = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1).replace(/\.0$/, "")}%`;
export const courseLabel = (course: Course) =>
  `${course.classroom_name && course.subject_name ? `${course.classroom_name} · ${course.subject_name}` : `Course ${course.id.slice(0, 8)}`} · ${course.academic_year}`;
export const roleHome: Record<Role, string> = {
  school_admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/dashboard",
};
export const roleLabel: Record<Role, string> = {
  school_admin: "School administrator",
  teacher: "Teacher workspace",
  student: "Student space",
};
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
