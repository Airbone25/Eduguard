import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { allPages } from "@/lib/api/pagination";
import type { CourseProgress, StudentProgress } from "@/types/api";
import type { StudentDashboard, VisibleIntervention } from "@/types/support";
export const studentApi = {
  dashboard: (signal?: AbortSignal) =>
    api<StudentDashboard>("/student/me/dashboard", { signal }),
  progress: (weeks: number, signal?: AbortSignal, asOf?: string) =>
    api<StudentProgress>(
      `/student/me/progress?history_weeks=${weeks}${asOf ? `&as_of_date=${encodeURIComponent(asOf)}` : ""}`,
      {
        signal,
      },
    ),
  support: (signal?: AbortSignal) =>
    allPages<VisibleIntervention>("/student/me/interventions", signal),
};
export const useStudentDashboard = () =>
  useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: ({ signal }) => studentApi.dashboard(signal),
  });
export const useMySupport = () =>
  useQuery({
    queryKey: ["student", "support"],
    queryFn: ({ signal }) => studentApi.support(signal),
  });
export function achievements(course: CourseProgress) {
  const items: { title: string; detail: string }[] = [];
  const streak = course.assignments.on_time_streak_weeks;
  if (streak != null && streak >= 2)
    items.push({
      title: "Consistency streak",
      detail: `${streak} consecutive weeks with every assignment completed on time.`,
    });
  const latest = course.weeks.at(-1);
  if (
    latest &&
    latest.assignments_completed != null &&
    latest.late_submissions != null &&
    latest.assignments_completed > latest.late_submissions
  )
    items.push({
      title: "Assignments on time",
      detail: `${latest.assignments_completed - latest.late_submissions} in the latest recorded week.`,
    });
  for (const item of course.improvements) {
    if (item.code === "attendance_improvement")
      items.push({
        title: "Attendance improvement",
        detail: `Up ${item.value.toFixed(1)} percentage points over four weeks.`,
      });
    if (item.code === "score_improvement")
      items.push({
        title: "Score improvement",
        detail: `Up ${item.value.toFixed(1)} points over four weeks.`,
      });
  }
  const prior = course.weeks
    .slice(0, -1)
    .flatMap((w) =>
      w.assessment_avg_score === null ? [] : [w.assessment_avg_score],
    );
  if (
    latest?.assessment_avg_score != null &&
    prior.length >= 2 &&
    latest.assessment_avg_score > Math.max(...prior)
  )
    items.push({
      title: "Personal best",
      detail: "Your latest score is your highest in this recorded period.",
    });
  return items;
}
