import { studentApi } from "@/lib/api/student";

export { studentApi };

export function achievements(course) {
  const items = [];
  if (!course) return items;

  const streak = course.assignments?.on_time_streak_weeks;
  if (streak != null && streak >= 2) {
    items.push({
      title: "Consistency Streak",
      detail: `${streak} consecutive recorded weeks with every assignment submitted on time.`,
    });
  }

  const latest = course.weeks?.at(-1);
  if (
    latest &&
    latest.assignments_completed != null &&
    latest.late_submissions != null &&
    latest.assignments_completed > latest.late_submissions
  ) {
    items.push({
      title: "On-Time Completion",
      detail: `${latest.assignments_completed - latest.late_submissions} assignments completed promptly this observation period.`,
    });
  }

  for (const item of course.improvements || []) {
    if (item.code === "attendance_improvement") {
      items.push({
        title: "Attendance Acceleration",
        detail: `Up ${Number(item.value).toFixed(1)} percentage points across the recent 4-week window.`,
      });
    }
    if (item.code === "score_improvement") {
      items.push({
        title: "Assessment Score Gain",
        detail: `Up ${Number(item.value).toFixed(1)} points across the recent 4-week window.`,
      });
    }
  }

  const prior = (course.weeks || [])
    .slice(0, -1)
    .flatMap((w) => (w.assessment_avg_score === null ? [] : [w.assessment_avg_score]));

  if (
    latest?.assessment_avg_score != null &&
    prior.length >= 2 &&
    latest.assessment_avg_score > Math.max(...prior)
  ) {
    items.push({
      title: "Personal Best Benchmark",
      detail: "Your recent score is the highest achieved in this observation sequence.",
    });
  }

  if (!items.length) {
    items.push({
      title: "Active Participation",
      detail: "Active engagement recorded in class sessions this week.",
    });
  }

  return items;
}
