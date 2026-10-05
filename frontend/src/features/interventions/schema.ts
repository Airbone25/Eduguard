import { z } from "zod";
const goal = z
  .string()
  .refine(
    (value) =>
      value.trim() === "" ||
      (Number.isFinite(Number(value)) &&
        Number(value) >= 0 &&
        Number(value) <= 100),
    "Enter a target from 0 to 100.",
  );
export const interventionSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title.").max(200),
    template_id: z.string(),
    start_date: z.iso.date("Enter a valid start date."),
    review_date: z
      .string()
      .refine(
        (value) => value === "" || z.iso.date().safeParse(value).success,
        "Enter a valid review date.",
      ),
    frequency: z.string().trim().max(200),
    attendance_target: goal,
    assessment_avg_score_target: goal,
    visibility_to_student: z.boolean(),
  })
  .refine(
    (value) => !value.review_date || value.review_date >= value.start_date,
    {
      path: ["review_date"],
      message: "Review date cannot be before the start date.",
    },
  );
export type InterventionForm = z.infer<typeof interventionSchema>;
export function interventionPayload(
  values: InterventionForm,
  courseId: string,
  predictionId?: string,
) {
  return {
    course_offering_id: courseId,
    title: values.title,
    start_date: values.start_date,
    ...(values.template_id ? { template_id: values.template_id } : {}),
    ...(predictionId ? { prediction_id: predictionId } : {}),
    ...(values.review_date ? { review_date: values.review_date } : {}),
    frequency: values.frequency,
    visibility_to_student: values.visibility_to_student,
    goal_definition: {
      ...(values.attendance_target.trim() !== ""
        ? { attendance_target: Number(values.attendance_target) }
        : {}),
      ...(values.assessment_avg_score_target.trim() !== ""
        ? {
            assessment_avg_score_target: Number(
              values.assessment_avg_score_target,
            ),
          }
        : {}),
    },
  };
}
