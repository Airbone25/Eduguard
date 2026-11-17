import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export function DistributionChart({
  title,
  values,
}: {
  title: string;
  values: { name: string; count: number }[];
}) {
  return (
    <section className="panel chart-panel">
      <h2>{title}</h2>
      <div className="chart-frame" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={values} accessibilityLayer={false}>
            <CartesianGrid stroke="#e7e2d6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#74796e" }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#74796e" }} />
            <Tooltip />
            <Bar
              dataKey="count"
              fill="#20241f"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="distribution-summary">
        {values.map((item) => (
          <li key={item.name}>
            {item.name}: <strong>{item.count}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
