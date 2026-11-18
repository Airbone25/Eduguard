import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function DistributionChart({ title, values = [] }) {
  const colors = ["#a54431", "#906524", "#39714e", "#716966", "#7977a2"];

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs mb-6">
      <h3 className="text-xs font-bold  text-slate-600 mb-3">{title}</h3>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={values}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#716966" }}
              axisLine={{ stroke: "#e3dfda" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#716966" }}
              axisLine={{ stroke: "#e3dfda" }}
              tickLine={false}
            />
            <Tooltip
              formatter={(val) => [`${val} students`, "Count"]}
              contentStyle={{
                backgroundColor: "#49344c",
                borderRadius: "6px",
                border: "none",
                color: "#fff",
                fontSize: "12px",
              }}
            />
            <Bar
              isAnimationActive={false}
              dataKey="count"
              radius={[4, 4, 0, 0]}
            >
              {values.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-values">
        <summary>View student counts</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Students</th>
            </tr>
          </thead>
          <tbody>
            {values.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
