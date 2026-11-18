import React, { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { interventionApi } from "@/lib/api/interventions";
import { today } from "@/features/progress/metrics";

export function InterventionEditor({
  studentId,
  courseId,
  prediction,
  initial,
  templateId = "",
  onClose,
  onSaved,
}) {
  const recommendation = prediction?.recommendations?.find(
    (r) => r.template_id === templateId,
  );

  const [title, setTitle] = useState(
    initial?.title || recommendation?.name || "",
  );
  const [selectedTemplate, setSelectedTemplate] = useState(
    initial?.template_id || templateId || "",
  );
  const [startDate, setStartDate] = useState(initial?.start_date || today());
  const [reviewDate, setReviewDate] = useState(initial?.review_date || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "");
  const [attendanceTarget, setAttendanceTarget] = useState(
    initial?.goal_definition?.attendance_target !== undefined
      ? String(initial.goal_definition.attendance_target)
      : "",
  );
  const [scoreTarget, setScoreTarget] = useState(
    initial?.goal_definition?.assessment_avg_score_target !== undefined
      ? String(initial.goal_definition.assessment_avg_score_target)
      : "",
  );
  const [visibleToStudent, setVisibleToStudent] = useState(
    initial?.visibility_to_student ?? true,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for this support plan.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        title: title.trim(),
        template_id: selectedTemplate || null,
        start_date: startDate,
        review_date: reviewDate || null,
        frequency: frequency.trim() || null,
        attendance_target: attendanceTarget ? Number(attendanceTarget) : null,
        assessment_avg_score_target: scoreTarget ? Number(scoreTarget) : null,
        visibility_to_student: visibleToStudent,
      };

      if (initial) {
        await interventionApi.patch(initial.id, {
          title: payload.title,
          frequency: payload.frequency,
          visibility_to_student: payload.visibility_to_student,
          review_date: payload.review_date,
          goal_definition: {
            attendance_target: payload.attendance_target,
            assessment_avg_score_target: payload.assessment_avg_score_target,
          },
        });
      } else {
        await interventionApi.create(
          studentId,
          courseId,
          payload,
          prediction?.id,
        );
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to save support plan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !submitting && onClose()}
      title={initial ? "Edit Support Plan" : "Create a support plan"}
      description="Define measurable goals and check-in schedules to support this student."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div
            role="alert"
            className="p-2.5 rounded bg-red-50 text-red-700 border border-red-200"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="field-plan-title"
            className="block font-semibold text-slate-700 mb-1"
          >
            Plan Title
          </label>
          <input
            id="field-plan-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly Math Attendance & Peer Tutoring Check-in"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="field-start-date"
              className="block font-semibold text-slate-700 mb-1"
            >
              Start Date
            </label>
            <input
              id="field-start-date"
              type="date"
              required
              value={startDate}
              readOnly={Boolean(initial)}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs"
            />
          </div>
          <div>
            <label
              htmlFor="field-review-date-optional"
              className="block font-semibold text-slate-700 mb-1"
            >
              Review Date (optional)
            </label>
            <input
              id="field-review-date-optional"
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="field-check-in-cadence"
            className="block font-semibold text-slate-700 mb-1"
          >
            Check-in schedule
          </label>
          <input
            id="field-check-in-cadence"
            type="text"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="e.g. Twice weekly, Monday & Thursday afternoon"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div>
            <label
              htmlFor="field-attendance-target"
              className="block font-semibold text-slate-700 mb-1"
            >
              Attendance Target (%)
            </label>
            <input
              id="field-attendance-target"
              type="number"
              min="0"
              max="100"
              value={attendanceTarget}
              onChange={(e) => setAttendanceTarget(e.target.value)}
              placeholder="e.g. 85"
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="field-assessment-score-target"
              className="block font-semibold text-slate-700 mb-1"
            >
              Assessment Score Target (%)
            </label>
            <input
              id="field-assessment-score-target"
              type="number"
              min="0"
              max="100"
              value={scoreTarget}
              onChange={(e) => setScoreTarget(e.target.value)}
              placeholder="e.g. 70"
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs font-mono"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleToStudent}
              onChange={(e) => setVisibleToStudent(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-slate-800 font-medium">
              Share plan goals with student on their dashboard
            </span>
          </label>
          <p className="text-[11px] text-slate-400 mt-1 pl-6">
            Detailed teacher follow-up notes always remain confidential.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save plan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
