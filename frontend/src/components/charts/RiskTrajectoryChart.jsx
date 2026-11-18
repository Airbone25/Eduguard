import React, { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateLabel } from "@/lib/utils";

const pct = (val) => `${Math.round((val ?? 0) * 100)}%`;

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="bg-slate-900 text-white rounded-md p-2.5 shadow-lg text-xs font-mono border border-slate-700">
      <p className="font-sans font-medium text-slate-300 pb-1 mb-1 border-b border-slate-700">
        {dateLabel(String(label))}
      </p>
      {row.risk !== undefined && (
        <div className="flex items-center gap-2 text-slate-100">
          <span className="w-2 h-2 rounded-full bg-slate-100" />
          <span>
            Observed: <strong>{pct(row.risk)}</strong>
          </span>
        </div>
      )}
      {row.proj !== undefined && (
        <div className="flex items-center gap-2 text-amber-300 mt-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>
            Projected: <strong>{pct(row.proj)}</strong>
          </span>
          {row.band && (
            <span className="text-[11px] text-amber-200/70">
              ({pct(row.band[0])}–{pct(row.band[1])})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function RiskTrajectoryChart({ predictions = [], forecast }) {
  const id = useId();

  // Deduplicate and sort by date
  const byDate = new Map();
  const sorted = [...predictions].sort((a, b) =>
    (a.as_of_date || "").localeCompare(b.as_of_date || ""),
  );

  for (const p of sorted) {
    if (p.as_of_date) {
      byDate.set(p.as_of_date, {
        as_of_date: p.as_of_date,
        risk: p.risk_probability,
      });
    }
  }

  const rows = [...byDate.values()];
  if (rows.length < 2 && !forecast?.points?.length) {
    return null;
  }

  // Connect forecast if present
  if (forecast?.points?.length) {
    const seen = new Set(rows.map((r) => r.as_of_date));
    for (const point of forecast.points) {
      if (!seen.has(point.week_start)) {
        seen.add(point.week_start);
        rows.push({
          as_of_date: point.week_start,
          proj: point.risk_probability,
          band: [point.band_low, point.band_high],
        });
      }
    }
  }

  const first = rows[0]?.risk ?? 0;
  const lastObserved =
    rows.filter((r) => r.risk !== undefined).at(-1)?.risk ?? first;
  const deltaPts = Math.round((lastObserved - first) * 100);

  return (
    <section
      aria-labelledby={id}
      className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
        <div>
          <h2
            id={id}
            className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2"
          >
            <span>How the signal has changed</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
              Temporal Model
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Recorded model estimates with the available projection range.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-600 shrink-0">
          Net movement:{" "}
          <span
            className={
              deltaPts > 0
                ? "text-red-600 font-semibold"
                : deltaPts < 0
                  ? "text-emerald-600 font-semibold"
                  : "text-slate-600"
            }
          >
            {deltaPts > 0 ? `+${deltaPts}` : deltaPts} pts
          </span>
        </div>
      </div>

      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#efebe8"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="as_of_date"
              tickFormatter={(d) => (d ? d.slice(5) : "")}
              tick={{ fontSize: 11, fill: "#716966" }}
              axisLine={{ stroke: "#e3dfda" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fontSize: 11, fill: "#716966" }}
              axisLine={{ stroke: "#e3dfda" }}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0.5} stroke="#cbd5e1" strokeDasharray="4 4" />
            {forecast && (
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="band"
                stroke="none"
                fill="#906524"
                fillOpacity={0.12}
                connectNulls
              />
            )}
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="risk"
              stroke="#49344c"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: "#49344c" }}
              name="Observed"
            />
            {forecast && (
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="proj"
                stroke="#906524"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: "#906524" }}
                name="Projected"
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 mt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
            <span>Recorded Observations</span>
          </span>
          {forecast && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
              <span>Model projection</span>
            </span>
          )}
        </div>
        <span className="text-slate-400">Reference line at 50%</span>
      </div>
      <details className="chart-values">
        <summary>View model estimates by week</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Observed</th>
              <th scope="col">Projected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.as_of_date}>
                <td>{dateLabel(row.as_of_date)}</td>
                <td>{row.risk == null ? "—" : pct(row.risk)}</td>
                <td>{row.proj == null ? "—" : pct(row.proj)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
