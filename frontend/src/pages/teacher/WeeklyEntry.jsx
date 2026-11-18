import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Download,
  FileSpreadsheet,
  Save,
  Upload,
  AlertCircle,
} from "lucide-react";
import { teacherApi } from "@/lib/api/teacher";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/common/domain";
import { LoadingSkeleton, ErrorState } from "@/components/common/states";
import {
  weeklyColumns,
  rawFields,
  validateWeeklyRecords,
  weeklyPayload,
} from "@/features/weekly-records/schema";
import { parseCsv } from "@/features/weekly-records/csv";
import { monday, today } from "@/features/progress/metrics";

export default function WeeklyEntry() {
  const { courseId = "" } = useParams();
  const [week, setWeek] = useState(monday(today()));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState({});
  const [csvError, setCsvError] = useState("");
  const [loadError, setLoadError] = useState(null);

  const draftKey = `eduguard.draft.${courseId}.${week}`;

  const loadRoster = async () => {
    setLoadError(null);
    setLoading(true);
    setNotice("");
    setErrors({});
    try {
      const roster = await teacherApi.students(courseId);
      setStudents(roster || []);

      // Check saved session draft
      const savedDraft = sessionStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          setRecords(JSON.parse(savedDraft));
          setNotice("Restored draft from this session.");
          setLoading(false);
          return;
        } catch {
          /* ignore */
        }
      }

      // Initialize default rows
      const initial = (roster || []).map((s) => ({
        student_id: s.id,
        selected: true,
        values: {
          classes_held: "5",
          classes_attended: "5",
          assessment_avg_score: "80",
          assessment_count: "1",
          assignment_count: "2",
          assignments_completed: "2",
          late_submissions: "0",
          assignment_avg_score: "85",
          quiz_avg_score: "78",
          study_hours_weekly: "6",
          participation_count: "4",
          participation_opportunities: "5",
        },
      }));
      setRecords(initial);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [courseId, week]);

  const handleFieldChange = (index, field, value) => {
    setRecords((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        values: { ...copy[index].values, [field]: value },
      };
      return copy;
    });
  };

  const handleToggleSelect = (index) => {
    setRecords((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const handleSelectAll = (checked) => {
    setRecords((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const handleSaveDraft = () => {
    sessionStorage.setItem(draftKey, JSON.stringify(records));
    setNotice("Draft successfully saved for this session.");
  };

  const handleCsvImport = async (e) => {
    setCsvError("");
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2)
        throw new Error(
          "CSV must contain a header and at least one student row.",
        );

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const rollIdx = header.indexOf("roll_number");
      if (rollIdx === -1)
        throw new Error("CSV must include a 'roll_number' column.");

      const updatedRecords = [...records];
      let matchedCount = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const roll = row[rollIdx]?.trim();
        const studentIndex = students.findIndex((s) => s.roll_number === roll);

        if (studentIndex !== -1) {
          matchedCount++;
          const currentValues = { ...updatedRecords[studentIndex].values };
          header.forEach((colName, colIdx) => {
            if (rawFields.includes(colName) && row[colIdx] !== undefined) {
              currentValues[colName] = row[colIdx].trim();
            }
          });
          updatedRecords[studentIndex] = {
            ...updatedRecords[studentIndex],
            selected: true,
            values: currentValues,
          };
        }
      }

      setRecords(updatedRecords);
      setNotice(
        `Imported observations for ${matchedCount} matching students. Review before submitting.`,
      );
    } catch (err) {
      setCsvError(err?.message || "Failed to parse CSV.");
    } finally {
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice("");
    setCsvError("");

    const validation = validateWeeklyRecords(records);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setNotice(
        validation.globalError ||
          "Please correct highlighted fields before submitting.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = weeklyPayload(records, courseId, week);
      await api("/teacher/weekly-records", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      sessionStorage.removeItem(draftKey);
      setNotice(
        `Successfully recorded observations for week of ${week}. Signals will reflect these entries.`,
      );
    } catch (err) {
      setNotice(
        err?.message || "Submission failed. Please check network connection.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) return <ErrorState error={loadError} retry={loadRoster} />;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/teacher/classes/${courseId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft size={13} />
          <span>Back to Class Analytics</span>
        </Link>
        <PageHeader
          title="Record the week."
          description="Add attendance, assessments, and assignments for your class. Review each selected row before submitting."
        >
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer transition-colors">
              <Upload size={13} />
              <span>Import CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvImport}
                className="sr-only"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <Save size={13} />
              <span>Save Draft</span>
            </button>
          </div>
        </PageHeader>
      </div>

      {/* Week Selector Bar */}
      <div className="p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label
            htmlFor="week-date"
            className="text-xs font-bold text-slate-700  font-mono"
          >
            Week Starting (Monday):
          </label>
          <input
            id="week-date"
            type="date"
            value={week}
            onChange={(e) => setWeek(monday(e.target.value))}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
          />
        </div>

        <p className="text-xs text-slate-400 font-mono">
          Save drafts anytime. Drafts stay in this browser tab until you submit
          or close it.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium"
        >
          {notice}
        </div>
      )}

      {csvError && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium flex items-center gap-2"
        >
          <AlertCircle size={15} />
          <span>{csvError}</span>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton label="Loading class roster…" />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                {records.filter((r) => r.selected).length} of {records.length}{" "}
                students selected
              </span>
              <button
                type="button"
                onClick={() =>
                  handleSelectAll(records.some((r) => !r.selected))
                }
                className="text-amber-800 hover:text-amber-950 font-semibold cursor-pointer"
              >
                {records.every((r) => r.selected)
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div
              role="region"
              aria-label="Weekly observations, scroll horizontally for all fields"
              tabIndex={0}
              className="overflow-x-auto max-h-[600px] overflow-y-auto"
            >
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-600 font-bold  text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Inc</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Student</th>
                    {weeklyColumns.map(([key, label]) => (
                      <th
                        key={key}
                        className="py-2.5 px-2 min-w-[75px] text-center"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {students.map((student, idx) => {
                    const row = records[idx] || { selected: false, values: {} };
                    return (
                      <tr
                        key={student.id}
                        className={
                          row.selected
                            ? "hover:bg-slate-50"
                            : "bg-slate-50/50 opacity-60"
                        }
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => handleToggleSelect(idx)}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            aria-label={`Select ${student.user?.first_name}`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {student.user?.first_name} {student.user?.last_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {student.roll_number}
                          </div>
                        </td>

                        {weeklyColumns.map(([field, label]) => {
                          const val = row.values[field] ?? "";
                          const fieldError = errors[`${idx}.${field}`];
                          return (
                            <td key={field} className="py-1 px-1.5">
                              <input
                                type="number"
                                step="any"
                                aria-label={`${student.user?.first_name} ${student.user?.last_name}: ${label}`}
                                aria-invalid={Boolean(fieldError)}
                                aria-describedby={
                                  fieldError
                                    ? `error-${idx}-${field}`
                                    : undefined
                                }
                                value={val}
                                disabled={!row.selected}
                                onChange={(e) =>
                                  handleFieldChange(idx, field, e.target.value)
                                }
                                className={`w-full px-2 py-1 text-center font-mono text-xs rounded border ${
                                  fieldError
                                    ? "border-red-500 bg-red-50 text-red-900"
                                    : "border-slate-200 bg-white text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                                } shadow-2xs`}
                                title={fieldError || ""}
                              />
                              {fieldError && (
                                <span
                                  id={`error-${idx}-${field}`}
                                  className="block text-xs text-red-700 mt-1"
                                >
                                  {fieldError}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-4 items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                All selected rows are saved together.
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {submitting ? "Saving records…" : "Save weekly records"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
