import { goalProgress } from "./metrics";
import { percent, dateLabel } from "@/lib/utils";
import type { CourseProgress } from "@/types/api";
import type { VisibleIntervention } from "@/types/support";
export function StudentSupport({
  plan,
  course,
}: {
  plan: VisibleIntervention;
  course?: CourseProgress;
}) {
  const targets = [
    {
      label: "Attendance",
      target: plan.goal_definition.attendance_target,
      value: course?.attendance.current ?? null,
    },
    {
      label: "Average score",
      target: plan.goal_definition.assessment_avg_score_target,
      value: course?.academic.current ?? null,
    },
  ];
  return (
    <article className="panel padded stack">
      <div className="heading-line">
        <h2>{plan.title}</h2>
        <span className="status-pill">{plan.status}</span>
      </div>
      <p>
        {course?.course.subject_name ?? "Support plan"} · Started{" "}
        {dateLabel(plan.start_date)}
        {plan.review_date ? ` · Review ${dateLabel(plan.review_date)}` : ""}
      </p>
      {targets
        .filter((t) => t.target != null)
        .map((t) => {
          const progress = goalProgress(t.target, t.value);
          return (
            <div key={t.label}>
              <h3>
                {t.label} goal · {percent(t.target ?? null)}
              </h3>
              <p>
                {progress
                  ? `${percent(t.value)} currently · ${progress.reached ? "Target reached — well done!" : "Keep building toward your target."}`
                  : "Your progress will appear when this week’s measurements are available."}
              </p>
              {progress && (
                <progress
                  aria-label={`${t.label} goal progress`}
                  value={progress.percent}
                  max={100}
                />
              )}
            </div>
          );
        })}
      {!targets.some((t) => t.target != null) && (
        <p>Your teacher will discuss the next steps with you.</p>
      )}
    </article>
  );
}
