import { useQuery } from "@tanstack/react-query";
import { allPages } from "@/lib/api/pagination";
import type { Prediction } from "@/types/support";
import { today } from "@/features/progress/metrics";
export function usePredictions(studentId: string, courseId: string) {
  return useQuery({
    queryKey: ["teacher", "student", studentId, "predictions", courseId],
    queryFn: ({ signal }) =>
      allPages<Prediction>(
        `/teacher/students/${encodeURIComponent(studentId)}/predictions?course_offering_id=${encodeURIComponent(courseId)}`,
        signal,
      ),
    enabled: Boolean(studentId && courseId),
  });
}
export function latestPrediction(
  predictions: Prediction[] = [],
  day = today(),
) {
  return predictions
    .filter((p) => p.as_of_date <= day)
    .sort(
      (a, b) =>
        b.as_of_date.localeCompare(a.as_of_date) ||
        b.created_at.localeCompare(a.created_at),
    )[0];
}
