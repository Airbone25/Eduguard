import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { allPages } from "@/lib/api/pagination";
import type { Intervention } from "@/types/support";
import type { InterventionForm } from "./schema";
import { interventionPayload } from "./schema";
export interface InterventionUpdate {
  id: string;
  sequence: number;
  kind: string;
  note: string | null;
  created_at: string;
}
export const interventionApi = {
  list: (studentId: string, courseId: string, signal?: AbortSignal) =>
    allPages<Intervention>(
      `/teacher/students/${encodeURIComponent(studentId)}/interventions?course_offering_id=${encodeURIComponent(courseId)}`,
      signal,
    ),
  all: (courseId: string, status: string, signal?: AbortSignal) =>
    allPages<Intervention>(
      `/teacher/interventions?${new URLSearchParams({ ...(courseId ? { course_offering_id: courseId } : {}), ...(status ? { status } : {}) })}`,
      signal,
    ),
  create: (
    studentId: string,
    courseId: string,
    values: InterventionForm,
    predictionId?: string,
  ) =>
    api<Intervention>(
      `/teacher/students/${encodeURIComponent(studentId)}/interventions`,
      {
        method: "POST",
        body: JSON.stringify(
          interventionPayload(values, courseId, predictionId),
        ),
      },
    ),
  patch: (id: string, body: Partial<Intervention>) =>
    api<Intervention>(`/teacher/interventions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  complete: (id: string) =>
    api<Intervention>(
      `/teacher/interventions/${encodeURIComponent(id)}/complete`,
      { method: "POST" },
    ),
  updates: (id: string, signal?: AbortSignal) =>
    allPages<InterventionUpdate>(
      `/teacher/interventions/${encodeURIComponent(id)}/updates`,
      signal,
    ),
  note: (id: string, note: string) =>
    api<InterventionUpdate>(
      `/teacher/interventions/${encodeURIComponent(id)}/updates`,
      { method: "POST", body: JSON.stringify({ note }) },
    ),
};
export const useInterventions = (studentId: string, courseId: string) =>
  useQuery({
    queryKey: ["teacher", "student", studentId, "interventions", courseId],
    queryFn: ({ signal }) => interventionApi.list(studentId, courseId, signal),
    enabled: Boolean(studentId && courseId),
  });
