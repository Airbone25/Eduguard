import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  interventionSchema,
  interventionPayload,
  type InterventionForm,
} from "./schema";
import { interventionApi } from "./api";
import type { Intervention, Prediction } from "@/types/support";
import { today } from "@/features/progress/metrics";
export function InterventionEditor({
  studentId,
  courseId,
  prediction,
  initial,
  templateId = "",
  onClose,
  onSaved,
}: {
  studentId: string;
  courseId: string;
  prediction?: Prediction;
  initial?: Intervention;
  templateId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const client = useQueryClient();
  const recommendation = prediction?.recommendations.find(
    (r) => r.template_id === templateId,
  );
  const form = useForm<InterventionForm>({
    resolver: zodResolver(interventionSchema),
    defaultValues: {
      title: initial?.title ?? recommendation?.name ?? "",
      template_id: initial?.template_id ?? templateId,
      start_date: initial?.start_date ?? today(),
      review_date: initial?.review_date ?? "",
      frequency: initial?.frequency ?? "",
      attendance_target:
        initial?.goal_definition.attendance_target?.toString() ?? "",
      assessment_avg_score_target:
        initial?.goal_definition.assessment_avg_score_target?.toString() ?? "",
      visibility_to_student: initial?.visibility_to_student ?? false,
    },
  });
  const mutation = useMutation({
    mutationFn: (values: InterventionForm) => {
      if (initial?.review_date && !values.review_date)
        throw new Error(
          "Choose a review date. An existing review date cannot be cleared.",
        );
      if (!initial)
        return interventionApi.create(
          studentId,
          courseId,
          values,
          prediction?.id,
        );
      const payload = interventionPayload(values, courseId);
      return interventionApi.patch(initial.id, {
        title: payload.title,
        frequency: payload.frequency,
        visibility_to_student: payload.visibility_to_student,
        goal_definition: payload.goal_definition,
        ...(payload.review_date ? { review_date: payload.review_date } : {}),
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["teacher"] });
      onSaved();
      onClose();
    },
  });
  const field = (
    name: keyof InterventionForm,
    label: string,
    type = "text",
  ) => (
    <div className="field">
      <label htmlFor={`plan-${name}`}>{label}</label>
      <input
        id={`plan-${name}`}
        type={type}
        {...form.register(name)}
        aria-invalid={Boolean(form.formState.errors[name])}
        aria-describedby={
          form.formState.errors[name] ? `${name}-error` : undefined
        }
        readOnly={Boolean(initial && name === "start_date")}
      />
      {form.formState.errors[name] && (
        <p className="field-error" id={`${name}-error`}>
          {form.formState.errors[name]?.message}
        </p>
      )}
    </div>
  );
  return (
    <Modal
      open
      title={initial ? "Edit support plan" : "Start a support plan"}
      description="Choose a practical next step together. Nothing is created until you save."
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        {!initial && (
          <div className="field">
            <label htmlFor="plan-template">Template</label>
            <select id="plan-template" {...form.register("template_id")}>
              <option value="">Custom support plan</option>
              {prediction?.recommendations.map((r) => (
                <option key={r.template_id} value={r.template_id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {field("title", "Plan title")}
        <div className="form-grid">
          {field("start_date", "Start date", "date")}
          {field("review_date", "Review date", "date")}
        </div>
        {field("frequency", "Frequency (optional)")}
        <div className="form-grid">
          {field("attendance_target", "Attendance target (%)", "number")}
          {field("assessment_avg_score_target", "Score target (%)", "number")}
        </div>
        <label className="checkbox-label">
          <input type="checkbox" {...form.register("visibility_to_student")} />
          Show this plan and its goals to the student
        </label>
        <p className="field-hint">Follow-up notes stay private to teachers.</p>
        {mutation.error && (
          <p role="alert" className="form-error">
            {mutation.error.message}
          </p>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save support plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
