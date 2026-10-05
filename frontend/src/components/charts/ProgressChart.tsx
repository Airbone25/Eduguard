import { useId } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CourseProgress } from "@/types/api";
import { chartWeeks } from "@/features/progress/metrics";
import { percent, dateLabel } from "@/lib/utils";

export function ProgressChart({
  weeks,
  asOf,
  metric = "score",
  count = 8,
}: {
  weeks: CourseProgress["weeks"];
  asOf: string;
  metric?: "score" | "attendance" | "assignments";
  count?: number;
}) {
  const id = useId();
  const data = chartWeeks(weeks, asOf, count);
  const title = {
    score: "Assessment scores",
    attendance: "Attendance",
    assignments: "Assignment completion",
  }[metric];
  const known = data.filter((row) => row[metric] !== null);
  return (
    <section className="panel chart-panel" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p>
        {known.length} of {count} weeks have data. Gaps represent missing
        records.
      </p>
      {known.length ? (
        <div className="chart-frame" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="week_start"
                tickFormatter={(date) => date.slice(5)}
                tick={{ fontSize: 11 }}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(label) => dateLabel(String(label))} />
              <Line
                type="linear"
                dataKey={metric}
                name={title}
                stroke="#205e4e"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="chart-empty">
          No measurements available for this period.
        </p>
      )}
      <details>
        <summary>View weekly values</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{title} by week</caption>
            <thead>
              <tr>
                <th>Week starting</th>
                <th>{title}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.week_start}>
                  <th scope="row">{dateLabel(row.week_start)}</th>
                  <td>{percent(row[metric])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
