import { z } from "zod";
export const weeklyColumns = [
  ["classes_held", "Classes held"],
  ["classes_attended", "Classes attended"],
  ["assessment_avg_score", "Assessment average"],
  ["assessment_count", "Assessments"],
  ["assignment_count", "Assignments"],
  ["assignments_completed", "Completed"],
  ["late_submissions", "Late submissions"],
  ["assignment_avg_score", "Assignment average"],
  ["quiz_avg_score", "Quiz average"],
  ["study_hours_weekly", "Study hours"],
  ["participation_count", "Participation"],
  ["participation_opportunities", "Participation opportunities"],
] as const;
export const rawFields = [
  ...weeklyColumns.map((c) => c[0]),
  "last_minute_submissions",
  "avg_submission_delay_days",
  "quiz_count",
  "quiz_attempt_count",
  "lms_login_count",
  "lms_active_days",
  "avg_lms_session_min",
  "total_lms_time_min",
  "days_since_last_login",
  "student_confidence_score",
  "student_checkin_text",
] as const;
export type RawField = (typeof rawFields)[number];
export interface WeeklyRecord extends Partial<
  Record<RawField, number | string | null>
> {
  student_id: string;
  course_offering_id: string;
  week_start: string;
  id: string;
}
const measurements = new Set([
  "study_hours_weekly",
  "assessment_avg_score",
  "assignment_avg_score",
  "quiz_avg_score",
  "avg_submission_delay_days",
  "avg_lms_session_min",
  "total_lms_time_min",
]);
export const weeklyFormSchema = z
  .object({
    records: z
      .array(
        z.object({
          student_id: z.string(),
          selected: z.boolean(),
          values: z.record(z.string(), z.string()),
        }),
      )
      .min(1),
  })
  .superRefine(({ records }, ctx) => {
    const selected = records.filter((r) => r.selected);
    if (!selected.length || selected.length > 100)
      ctx.addIssue({
        code: "custom",
        path: ["records"],
        message: "Select between 1 and 100 students per submission.",
      });
    records.forEach((record, index) => {
      if (!record.selected) return;
      const issue = (key: string, message: string) =>
        ctx.addIssue({
          code: "custom",
          path: ["records", index, "values", key],
          message,
        });
      Object.entries(record.values).forEach(([key, value]) => {
        if (!rawFields.includes(key as RawField)) {
          issue(key, "Only raw school fields are accepted.");
          return;
        }
        if (key === "student_checkin_text") {
          if (value.length > 5000) issue(key, "Maximum 5000 characters.");
          return;
        }
        if (value.trim() === "") return;
        const number = Number(value);
        const max =
          key.includes("score") && key !== "student_confidence_score"
            ? 100
            : key === "study_hours_weekly"
              ? 168
              : key === "lms_active_days"
                ? 7
                : key === "student_confidence_score"
                  ? 5
                  : 1000000;
        if (
          !Number.isFinite(number) ||
          number < 0 ||
          number > max ||
          (!measurements.has(key) && !Number.isInteger(number)) ||
          (key === "student_confidence_score" && number < 1)
        )
          issue(
            key,
            `Enter ${measurements.has(key) ? "a number" : "a whole number"} from ${key === "student_confidence_score" ? 1 : 0} to ${max}.`,
          );
        if (
          measurements.has(key) &&
          value.includes(".") &&
          value.split(".")[1].length > 4
        )
          issue(key, "Use at most four decimal places.");
      });
      for (const [child, parent] of [
        ["classes_attended", "classes_held"],
        ["assignments_completed", "assignment_count"],
        ["late_submissions", "assignment_count"],
        ["late_submissions", "assignments_completed"],
        ["last_minute_submissions", "assignment_count"],
        ["participation_count", "participation_opportunities"],
      ]) {
        if (
          record.values[child]?.trim() &&
          record.values[parent]?.trim() &&
          Number(record.values[child]) > Number(record.values[parent])
        )
          issue(
            child,
            `${child.replaceAll("_", " ")} cannot exceed ${parent.replaceAll("_", " ")}.`,
          );
      }
    });
  });
export type WeeklyForm = z.infer<typeof weeklyFormSchema>;
export function weeklyPayload(
  form: WeeklyForm,
  courseId: string,
  week: string,
) {
  return {
    records: form.records
      .filter((r) => r.selected)
      .map((row) => ({
        student_id: row.student_id,
        course_offering_id: courseId,
        week_start: week,
        ...Object.fromEntries(
          rawFields.map((field) => [
            field,
            row.values[field]?.trim()
              ? field === "student_checkin_text"
                ? row.values[field]
                : Number(row.values[field])
              : null,
          ]),
        ),
      })),
  };
}
