import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/features/progress/student";
import { PageHeader } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { SectionNav } from "@/components/common/SectionNav";
import { today, termRange } from "@/features/progress/metrics";
export default function Progress() {
  const [weeks, setWeeks] = useState(8);
  const [metric, setMetric] = useState("Scores");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState(today());
  const term = termRange(termStart, termEnd);
  const inTerm = weeks === 52;
  const count = inTerm ? term.weeks : weeks;
  const asOf = inTerm ? termEnd : undefined;
  const query = useQuery({
    queryKey: ["student", "progress", count, asOf],
    queryFn: ({ signal }) => studentApi.progress(count, signal, asOf),
    enabled: !inTerm || !term.error,
  });
  return (
    <>
      <PageHeader
        title="Look how far you’re coming."
        description="Compare with your own earlier weeks, at your own pace."
      />
      <div className="course-toolbar">
        <SectionNav
          label="Progress measurement"
          items={["Scores", "Attendance", "Assignments"]}
          value={metric}
          onChange={setMetric}
        />
        <label>
          Time range
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          >
            <option value={4}>4 weeks</option>
            <option value={8}>8 weeks</option>
            <option value={52}>Term</option>
          </select>
        </label>
      </div>
      {inTerm && (
        <section className="panel padded">
          <h2>Your term dates</h2>
          <p>
            Use the dates provided by your school. Only weeks starting within
            this range are shown.
          </p>
          <div className="form-grid">
            <label>
              Term start
              <input
                type="date"
                max={today()}
                value={termStart}
                onInput={(e) => setTermStart(e.currentTarget.value)}
                onChange={(e) => setTermStart(e.target.value)}
              />
            </label>
            <label>
              Term end
              <input
                type="date"
                min={termStart}
                max={today()}
                value={termEnd}
                onInput={(e) => setTermEnd(e.currentTarget.value)}
                onChange={(e) => setTermEnd(e.target.value)}
              />
            </label>
          </div>
        </section>
      )}
      {inTerm && term.error ? (
        <p role="status">{term.error}</p>
      ) : query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.courses.length ? (
        query.data.courses.map((c) => (
          <section key={c.course.id} className="stack">
            <h2>
              {c.course.subject_name} · {c.course.classroom_name}
            </h2>
            <ProgressChart
              weeks={
                inTerm
                  ? c.weeks.filter(
                      (w) =>
                        w.week_start >= termStart && w.week_start <= termEnd,
                    )
                  : c.weeks
              }
              asOf={query.data.as_of_date}
              count={count}
              metric={
                metric === "Scores"
                  ? "score"
                  : metric === "Attendance"
                    ? "attendance"
                    : "assignments"
              }
            />
          </section>
        ))
      ) : (
        <EmptyState
          title="No courses yet"
          description="Your progress will appear after your school adds your course enrollment."
        />
      )}
    </>
  );
}
