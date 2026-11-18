import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateLabel } from "@/lib/utils";

function ProgressTooltip({ active, payload, label, unit = "%" }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-slate-900 text-white rounded-md p-2 shadow-lg text-xs font-mono border border-slate-700">
      <p className="font-sans font-medium text-slate-300 pb-1 mb-1 border-b border-slate-700">
        Week of {dateLabel(String(label))}
      </p>
      <p className="text-slate-100">
        Value:{" "}
        <strong>
          {val !== null && val !== undefined
            ? `${Math.round(val)}${unit}`
            : "—"}
        </strong>
      </p>
    </div>
  );
}

export function ProgressChart({ weeks = [], metric = "score" }) {
  const metricConfig = {
    score: {
      key: "assessment_avg_score",
      label: "Assessment Score %",
      color: "#69517b",
      domain: [0, 100],
    },
    attendance: {
      key: "attendance_percent",
      label: "Attendance Rate %",
      color: "#39714e",
      domain: [0, 100],
    },
    assignments: {
      key: "assignments_completed",
      label: "Assignments Completed",
      color: "#69517b",
      domain: ["auto", "auto"],
    },
  }[metric] || {
    key: "assessment_avg_score",
    label: "Assessment Score %",
    color: "#69517b",
    domain: [0, 100],
  };

  const chartData = (weeks || []).map((w) => ({
    week_start: w.week_start,
    value: w[metricConfig.key] ?? null,
  }));

  if (!chartData.length) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold  text-slate-600">
          Weekly Trend · {metricConfig.label}
        </h3>
        <span className="text-[11px] font-mono text-slate-400">
          {chartData.length} recorded weeks
        </span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#efebe8"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="week_start"
              tickFormatter={(d) => (d ? d.slice(5) : "")}
              tick={{ fontSize: 11, fill: "#716966" }}
              axisLine={{ stroke: "#e3dfda" }}
              tickLine={false}
            />
            <YAxis
              domain={metricConfig.domain}
              tick={{ fontSize: 11, fill: "#716966" }}
              axisLine={{ stroke: "#e3dfda" }}
              tickLine={false}
            />
            <Tooltip
              content={
                <ProgressTooltip unit={metric === "assignments" ? "" : "%"} />
              }
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="value"
              stroke={metricConfig.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: metricConfig.color }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-values">
        <summary>View recorded values</summary>
        <table>
          <caption className="sr-only">{metricConfig.label} by week</caption>
          <thead>
            <tr>
              <th scope="col">Week of</th>
              <th scope="col">{metricConfig.label}</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.week_start}>
                <td>{dateLabel(row.week_start)}</td>
                <td>{row.value ?? "Not recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
