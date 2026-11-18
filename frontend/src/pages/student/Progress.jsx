import React, { useState, useEffect } from "react";
import { studentApi } from "@/lib/api/student";
import { PageHeader } from "@/components/common/domain";
import { SectionNav } from "@/components/common/SectionNav";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { today, termRange } from "@/features/progress/metrics";

export default function Progress() {
  const [weeks, setWeeks] = useState(8);
  const [metric, setMetric] = useState("Scores");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState(today());
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const term = termRange(termStart, termEnd);
  const inTerm = weeks === 52;
  const count = inTerm ? term.weeks : weeks;

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await studentApi.progress(count || 8);
      setProgress(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [weeks]);

  if (loading) {
    return <LoadingSkeleton label="Loading your progress…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  const courses = progress?.courses || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your progress, week by week."
        description="See what’s changing in your learning, attendance, and completed assignments."
      />

      <div className="p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SectionNav
          items={["Scores", "Attendance", "Assignments"]}
          value={metric}
          onChange={setMetric}
          label="Progress metric"
        />

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="weeks-range" className="font-semibold text-slate-700">
            Window:
          </label>
          <select
            id="weeks-range"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-800 cursor-pointer shadow-2xs"
          >
            <option value={4}>Last 4 Weeks</option>
            <option value={8}>Last 8 Weeks</option>
            <option value={52}>Full Academic Term</option>
          </select>
        </div>
      </div>

      {inTerm && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label
              htmlFor="field-term-start-date"
              className="block font-semibold text-slate-700 mb-1"
            >
              Term Start Date
            </label>
            <input
              id="field-term-start-date"
              type="date"
              value={termStart}
              onChange={(e) => setTermStart(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="field-term-end-date"
              className="block font-semibold text-slate-700 mb-1"
            >
              Term End Date
            </label>
            <input
              id="field-term-end-date"
              type="date"
              value={termEnd}
              onChange={(e) => setTermEnd(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono"
            />
          </div>
        </div>
      )}

      {courses.length ? (
        courses.map((c) => (
          <div key={c.course.id} className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {c.course.subject_name} ({c.course.classroom_name})
            </h3>
            <ProgressChart
              weeks={c.weeks}
              metric={
                metric === "Scores"
                  ? "score"
                  : metric === "Attendance"
                    ? "attendance"
                    : "assignments"
              }
            />
          </div>
        ))
      ) : (
        <EmptyState
          title="No courses found"
          description="Progress will appear once your school links your courses."
        />
      )}
    </div>
  );
}
