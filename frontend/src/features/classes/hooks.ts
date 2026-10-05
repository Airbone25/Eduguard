import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { teacherApi } from "@/lib/api/teacher";
import type { SummarySort } from "@/types/api";
export const useMe = () =>
  useQuery({
    queryKey: ["auth", "me"],
    queryFn: ({ signal }) => authApi.me(signal),
  });
export const useTeacherClasses = () =>
  useQuery({
    queryKey: ["teacher", "classes"],
    queryFn: ({ signal }) => teacherApi.classes(signal),
  });
export const useTeacherClassStudents = (id: string) =>
  useQuery({
    queryKey: ["teacher", "class", id, "students"],
    queryFn: ({ signal }) => teacherApi.students(id, signal),
    enabled: Boolean(id),
  });
export const useStudentDetails = (id: string) =>
  useQuery({
    queryKey: ["teacher", "student", id],
    queryFn: ({ signal }) => teacherApi.student(id, signal),
    enabled: Boolean(id),
  });
export const useClassSummary = (id: string, sort: SummarySort) =>
  useQuery({
    queryKey: ["teacher", "class", id, "summary", sort],
    queryFn: ({ signal }) => teacherApi.summary(id, sort, signal),
    enabled: Boolean(id),
  });
export const useStudentProgress = (id: string, courseId: string) =>
  useQuery({
    queryKey: ["teacher", "student", id, "progress", courseId],
    queryFn: ({ signal }) => teacherApi.progress(id, courseId, signal),
    enabled: Boolean(id && courseId),
  });
