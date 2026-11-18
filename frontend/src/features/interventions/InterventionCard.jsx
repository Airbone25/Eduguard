import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  MessageSquare,
  Play,
  XCircle,
} from "lucide-react";
import { interventionApi } from "@/lib/api/interventions";
import { dateLabel, percent } from "@/lib/utils";
import { goalProgress } from "@/features/progress/metrics";
import { InterventionEditor } from "./InterventionEditor";

export function InterventionCard({ plan, progress, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [followups, setFollowups] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  const statusColors =
    {
      active: "bg-emerald-50 text-emerald-800 border-emerald-200",
      planned: "bg-amber-50 text-amber-800 border-amber-200",
      completed: "bg-blue-50 text-blue-800 border-blue-200",
      cancelled: "bg-slate-100 text-slate-600 border-slate-200",
    }[plan.status] || "bg-slate-100 text-slate-700 border-slate-200";

  const handleToggleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !followups.length) {
      setLoadingUpdates(true);
      try {
        const data = await interventionApi.updates(plan.id);
        setFollowups(data || []);
      } catch (err) {
        console.error("Could not load updates:", err);
      } finally {
        setLoadingUpdates(false);
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      if (newStatus === "completed") {
        await interventionApi.complete(plan.id);
      } else {
        await interventionApi.patch(plan.id, { status: newStatus });
      }
      setActionNotice(`Plan updated to ${newStatus}.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err?.message || "Failed to update status");
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const saved = await interventionApi.note(plan.id, newNote.trim());
      setFollowups((prev) => [saved, ...prev]);
      setNewNote("");
      setActionNotice("Follow-up note logged.");
    } catch (err) {
      alert(err?.message || "Failed to log note");
    } finally {
      setSavingNote(false);
    }
  };

  const isOpen = plan.status === "active" || plan.status === "planned";

  return (
    <article className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs mb-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold  border ${statusColors}`}
            >
              {plan.status}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <Calendar size={12} />
              <span>Started {dateLabel(plan.start_date)}</span>
              {plan.review_date && (
                <span>· Review {dateLabel(plan.review_date)}</span>
              )}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            {plan.title}
          </h3>
          {plan.frequency && (
            <p className="text-xs text-slate-500 mt-0.5">
              Cadence: {plan.frequency}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium bg-slate-50 border border-slate-200 px-2 py-1 rounded">
            {plan.visibility_to_student ? (
              <>
                <Eye size={12} className="text-emerald-600" />
                <span>Shared with student</span>
              </>
            ) : (
              <>
                <EyeOff size={12} className="text-slate-400" />
                <span>Teacher eyes only</span>
              </>
            )}
          </span>
          {isOpen && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              title="Edit plan"
            >
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Goal Progress Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
        {plan.goal_definition?.attendance_target != null && (
          <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-700">
                Attendance Target
              </span>
              <span className="font-mono font-bold text-slate-900">
                {plan.goal_definition.attendance_target}%
              </span>
            </div>
            {progress?.attendance?.current != null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Current: {percent(progress.attendance.current)}</span>
                  <span>
                    {progress.attendance.current >=
                    plan.goal_definition.attendance_target
                      ? "Target Met!"
                      : "In Progress"}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, (progress.attendance.current / plan.goal_definition.attendance_target) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {plan.goal_definition?.assessment_avg_score_target != null && (
          <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-slate-700">
                Assessment Score Target
              </span>
              <span className="font-mono font-bold text-slate-900">
                {plan.goal_definition.assessment_avg_score_target}%
              </span>
            </div>
            {progress?.academic?.current != null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Current: {percent(progress.academic.current)}</span>
                  <span>
                    {progress.academic.current >=
                    plan.goal_definition.assessment_avg_score_target
                      ? "Target Met!"
                      : "In Progress"}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, (progress.academic.current / plan.goal_definition.assessment_avg_score_target) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {actionNotice && (
        <div className="text-xs text-emerald-700 font-medium mb-3">
          {actionNotice}
        </div>
      )}

      {/* Action Controls & Follow-up expander */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5">
          {isOpen && plan.status === "planned" && (
            <button
              type="button"
              onClick={() => handleStatusChange("active")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer"
            >
              <Play size={12} />
              <span>Activate</span>
            </button>
          )}

          {isOpen && (
            <>
              <button
                type="button"
                onClick={() => handleStatusChange("completed")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
              >
                <CheckCircle2 size={12} className="text-blue-600" />
                <span>Mark Completed</span>
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("cancelled")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-slate-500 hover:text-red-700 font-medium cursor-pointer"
              >
                <XCircle size={12} />
                <span>Cancel</span>
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleExpand}
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
        >
          <MessageSquare size={13} />
          <span>{expanded ? "Hide Follow-ups" : "Follow-up Timeline"}</span>
          <span className="font-mono text-[11px] px-1 rounded bg-slate-100 text-slate-500">
            {followups.length}
          </span>
        </button>
      </div>

      {/* Expandable Notes / Follow-ups Area */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in duration-100">
          <h4 className="text-xs font-bold  text-slate-700">
            Chronological Follow-up Notes
          </h4>

          {loadingUpdates ? (
            <p className="text-xs text-slate-400">Loading notes…</p>
          ) : followups.length ? (
            <div className="space-y-2">
              {followups.map((update, idx) => (
                <div
                  key={update.id || idx}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                    <span>
                      {new Date(
                        update.created_at || Date.now(),
                      ).toLocaleString()}
                    </span>
                    <span className="uppercase text-slate-500 font-bold">
                      {update.kind?.replace("_", " ") || "NOTE"}
                    </span>
                  </div>
                  <p className="text-slate-800 leading-relaxed font-sans">
                    {update.note}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              No notes logged yet.
            </p>
          )}

          {isOpen && (
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={2}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log a private follow-up observation or check-in note…"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs"
              />
              <button
                type="submit"
                disabled={savingNote || !newNote.trim()}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md text-xs cursor-pointer disabled:opacity-50"
              >
                {savingNote ? "Saving…" : "Add Private Follow-up"}
              </button>
            </form>
          )}
        </div>
      )}

      {editing && (
        <InterventionEditor
          initial={plan}
          studentId={plan.student_id}
          courseId={plan.course_offering_id}
          onClose={() => setEditing(false)}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </article>
  );
}
