import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/components/common/states";
import type { CourseProgress } from "@/types/api";
import type { Intervention } from "@/types/support";
import { interventionApi } from "./api";
import { InterventionEditor } from "./InterventionEditor";
import { dateLabel, percent } from "@/lib/utils";
import { goalProgress } from "@/features/progress/metrics";
const noteSchema = z.object({
  note: z.string().trim().min(1, "Enter a follow-up note.").max(5000),
});
export function InterventionCard({
  plan,
  progress,
}: {
  plan: Intervention;
  progress?: CourseProgress;
}) {
  const client = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<"complete" | "cancelled" | null>(null);
  const [notice, setNotice] = useState("");
  const form = useForm<{ note: string }>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  });
  const updates = useQuery({
    queryKey: ["teacher", "intervention", plan.id, "updates"],
    queryFn: ({ signal }) => interventionApi.updates(plan.id, signal),
    enabled: expanded,
  });
  const action = useMutation({
    mutationFn: (kind: "active" | "cancelled" | "complete") =>
      kind === "complete"
        ? interventionApi.complete(plan.id)
        : interventionApi.patch(plan.id, { status: kind }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["teacher"] });
      setConfirm(null);
      setNotice("Support plan updated.");
    },
  });
  const note = useMutation({
    mutationFn: ({ note }: { note: string }) =>
      interventionApi.note(plan.id, note),
    onSuccess: async () => {
      form.reset();
      await client.invalidateQueries({
        queryKey: ["teacher", "intervention", plan.id, "updates"],
      });
      setNotice("Follow-up saved.");
    },
  });
  const open = plan.status === "active" || plan.status === "planned";
  return (
    <article className="panel padded intervention-card">
      <div className="section-heading compact">
        <div>
          <span className="status-pill">{plan.status}</span>
          <h3>{plan.title}</h3>
          <p>
            Started {dateLabel(plan.start_date)}
            {plan.review_date ? ` · Review ${dateLabel(plan.review_date)}` : ""}
          </p>
        </div>
        <span className="data-note">
          {plan.visibility_to_student ? "Visible to student" : "Teacher only"}
        </span>
      </div>
      <p className="body-copy">
        Frequency: {plan.frequency || "Not specified"}
      </p>
      <div className="goal-grid">
        {(["attendance_target", "assessment_avg_score_target"] as const).map(
          (key) => {
            const target = plan.goal_definition[key];
            if (target == null) return null;
            const value =
              key === "attendance_target"
                ? (progress?.attendance.current ?? null)
                : (progress?.academic.current ?? null);
            const measured = goalProgress(target, value);
            return (
              <div key={key}>
                <strong>
                  {key === "attendance_target" ? "Attendance" : "Average score"}{" "}
                  goal: {target}%
                </strong>
                <p>
                  Current: {percent(value)}
                  {measured?.reached ? " · Target reached" : ""}
                </p>
                {measured && (
                  <progress
                    aria-label={`${key === "attendance_target" ? "Attendance" : "Score"} goal progress`}
                    max={100}
                    value={measured.percent}
                  />
                )}
              </div>
            );
          },
        )}
      </div>
      <p className="data-note">
        Current metrics are a comparison, not a claim that the plan caused a
        change.
      </p>
      <div className="form-actions">
        {open && (
          <>
            <Button variant="outline" onClick={() => setEdit(true)}>
              Edit
            </Button>
            {plan.status === "planned" && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() => action.mutate("active")}
              >
                Activate
              </Button>
            )}
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => setConfirm("complete")}
            >
              Complete
            </Button>
            <Button
              variant="ghost"
              disabled={action.isPending}
              onClick={() => setConfirm("cancelled")}
            >
              Cancel plan
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide follow-ups" : "View follow-ups"}
        </Button>
      </div>
      {notice && (
        <p role="status" className="success-message">
          {notice}
        </p>
      )}
      {action.error && (
        <p role="alert" className="form-error">
          {action.error.message}
        </p>
      )}
      {expanded && (
        <div className="followups">
          {updates.isPending ? (
            <p role="status">Loading follow-ups…</p>
          ) : updates.error ? (
            <ErrorState
              error={updates.error}
              retry={() => {
                void updates.refetch();
              }}
            />
          ) : (
            <ol>
              {updates.data.map((update) => (
                <li key={update.id}>
                  <strong>
                    {new Date(update.created_at).toLocaleString()} ·{" "}
                    {update.kind.replaceAll("_", " ")}
                  </strong>
                  <p>{update.note}</p>
                </li>
              ))}
            </ol>
          )}
          <form onSubmit={form.handleSubmit((value) => note.mutate(value))}>
            <div className="field">
              <label htmlFor={`note-${plan.id}`}>
                Private teacher follow-up
              </label>
              <textarea
                id={`note-${plan.id}`}
                {...form.register("note")}
                aria-invalid={Boolean(form.formState.errors.note)}
              />
              {form.formState.errors.note && (
                <p className="field-error">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
            {note.error && (
              <p role="alert" className="form-error">
                {note.error.message}
              </p>
            )}
            <Button disabled={note.isPending}>
              {note.isPending ? "Saving…" : "Save follow-up"}
            </Button>
          </form>
        </div>
      )}
      {edit && (
        <InterventionEditor
          initial={plan}
          studentId={plan.student_id}
          courseId={plan.course_offering_id}
          onClose={() => setEdit(false)}
          onSaved={() => setNotice("Support plan updated.")}
        />
      )}
      {confirm && (
        <Modal
          open
          title={
            confirm === "complete" ? "Complete this plan?" : "Cancel this plan?"
          }
          description="This changes the plan to a closed status. Its history will remain available."
          onOpenChange={(value) => {
            if (!value && !action.isPending) setConfirm(null);
          }}
        >
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => setConfirm(null)}
            >
              Keep open
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => action.mutate(confirm)}
            >
              {action.isPending ? "Saving…" : "Confirm status change"}
            </Button>
          </div>
        </Modal>
      )}
    </article>
  );
}
