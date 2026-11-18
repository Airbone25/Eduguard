import React from "react";
import { Award, CheckCircle2, Target } from "lucide-react";
import { dateLabel, percent } from "@/lib/utils";
import { goalProgress } from "./metrics";

export function StudentSupport({ plan, course }) {
  const targets = [
    {
      label: "Attendance Rate",
      target: plan.goal_definition?.attendance_target,
      value: course?.attendance?.current ?? null,
    },
    {
      label: "Average Assessment Score",
      target: plan.goal_definition?.assessment_avg_score_target,
      value: course?.academic?.current ?? null,
    },
  ].filter((t) => t.target != null);

  return (
    <article className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs mb-4">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
        <div>
          <span className="text-[11px] font-mono  text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
            Shared Learning Plan
          </span>
          <h3 className="text-sm font-bold text-slate-900 mt-1">
            {plan.title}
          </h3>
          <p className="text-xs text-slate-500 font-mono">
            {course?.course?.subject_name || "Course"} · Started{" "}
            {dateLabel(plan.start_date)}
            {plan.review_date && ` · Review on ${dateLabel(plan.review_date)}`}
          </p>
        </div>
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-full">
          <Target size={18} />
        </div>
      </div>

      {targets.length ? (
        <div className="space-y-4">
          {targets.map((t) => {
            const prog = goalProgress(t.target, t.value);
            return (
              <div
                key={t.label}
                className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg text-xs"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-700">
                    {t.label} Goal
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {t.target}%
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-mono mb-1.5">
                  <span>Current: {percent(t.value)}</span>
                  <span>
                    {prog?.reached
                      ? "Target achieved! Keep it up!"
                      : "Building steadily"}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${prog?.percent || 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          Your teacher is collaborating with you on your weekly learning goals.
        </p>
      )}
    </article>
  );
}
