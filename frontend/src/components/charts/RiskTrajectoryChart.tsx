import { useId } from "react";
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
import type { ForecastResponse, Prediction } from "@/types/support";
import { ApiError } from "@/lib/api/client";
import { dateLabel } from "@/lib/utils";

const pct = (value: number) => `${Math.round(value * 100)}%`;

type Row = {
  as_of_date: string;
  risk?: number;
  proj?: number;
  band?: [number, number];
};

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload?: Row }[];
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="chart-tip">
      <p className="chart-tip-date">{dateLabel(String(label))}</p>
      {row.risk !== undefined && (
        <p>
          <span className="chart-tip-swatch history" aria-hidden="true" />
          Observed {pct(row.risk)}
        </p>
      )}
      {row.proj !== undefined && (
        <p>
          <span className="chart-tip-swatch projection" aria-hidden="true" />
          Projected {pct(row.proj)}
          {row.band && (
            <span className="chart-tip-band">
              {" "}
              · {pct(row.band[0])}–{pct(row.band[1])}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export function RiskTrajectoryChart({
  predictions,
  forecast,
  forecastError,
}: {
  predictions: Prediction[];
  forecast?: ForecastResponse;
  forecastError?: Error | null;
}) {
  const id = useId();
  // One point per insight date: when a date was run twice, keep the later run.
  const byDate = new Map<string, { as_of_date: string; risk_probability: number }>();
  for (const p of [...predictions].sort((a, b) =>
    a.as_of_date.localeCompare(b.as_of_date) ||
    a.created_at.localeCompare(b.created_at),
  )) {
    byDate.set(p.as_of_date, {
      as_of_date: p.as_of_date,
      risk_probability: p.risk_probability,
    });
  }
  const data: Row[] = [...byDate.values()].map((row) => ({
    as_of_date: row.as_of_date,
    risk: row.risk_probability,
  }));
  if (data.length < 2) return null;
  const insufficient =
    forecastError instanceof ApiError &&
    forecastError.code === "FORECAST_INSUFFICIENT_HISTORY";
  const rows: Row[] = data.map((row) =>
    forecast && row.as_of_date === forecast.as_of_date
      ? { ...row, proj: row.risk }
      : row,
  );
  if (forecast && forecast.points.length) {
    const seen = new Set(data.map((row) => row.as_of_date));
    for (const point of forecast.points) {
      if (seen.has(point.week_start)) continue;
      seen.add(point.week_start);
      rows.push({
        as_of_date: point.week_start,
        proj: point.risk_probability,
        band: [point.band_low, point.band_high],
      });
    }
  }
  const showForecast = forecast?.points.length
    ? rows.some((row) => row.band)
    : false;
  const first = data[0].risk ?? 0;
  const last = data[data.length - 1].risk ?? 0;
  const change = Math.round((last - first) * 100);
  return (
    <section className="panel chart-panel" aria-labelledby={id}>
      <h2 id={id}>Risk trajectory</h2>
      <p>
        Model probability at each saved insight, from {dateLabel(data[0].as_of_date)} to{" "}
        {dateLabel(data[data.length - 1].as_of_date)} ({change === 0 ? "no change" : `${change > 0 ? "+" : ""}${change} pts`}). Teachers only — never shown to
        students.
      </p>
      <div className="chart-frame" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={rows} accessibilityLayer={false}>
            <CartesianGrid stroke="#e7e2d6" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="as_of_date"
              tickFormatter={(date) => date.slice(5)}
              tick={{ fontSize: 11, fill: "#74796e" }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(value) => `${Math.round(value * 100)}%`}
              tick={{ fontSize: 11, fill: "#74796e" }}
            />
            <Tooltip
              content={<ChartTip />}
              cursor={{ stroke: "#cfcab9", strokeDasharray: "3 3" }}
            />
            <ReferenceLine y={0.5} stroke="#cfcab9" strokeDasharray="4 4" />
            {showForecast && (
              <ReferenceLine
                x={forecast?.as_of_date ?? ""}
                stroke="#a3672a"
                strokeDasharray="2 3"
                label={{
                  value: "Forecast",
                  position: "insideTopLeft",
                  fontSize: 10,
                  fill: "#52574d",
                }}
              />
            )}
            {showForecast && (
              <Area
                type="linear"
                dataKey="band"
                stroke="none"
                fill="#a3672a"
                fillOpacity={0.12}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
            <Line
              type="linear"
              dataKey="risk"
              name="Observed"
              stroke="#20241f"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            {showForecast && (
              <Line
                type="linear"
                dataKey="proj"
                name="Projected"
                stroke="#a3672a"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                dot={{ r: 2.5 }}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {showForecast && (
        <p className="chart-caption">
          Projection from recorded observations — not a diagnosis. The shaded
          band is the {Math.round((forecast?.band_level ?? 0) * 100)}% interval across
          simulated paths.
        </p>
      )}
      {insufficient && forecastError && (
        <p className="chart-note">{forecastError.message}</p>
      )}
      <details>
        <summary>View insight values</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Risk probability by insight date</caption>
            <thead>
              <tr>
                <th>Records through</th>
                <th>Risk probability</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.as_of_date}>
                  <th scope="row">{dateLabel(row.as_of_date)}</th>
                  <td>{pct(row.risk ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
