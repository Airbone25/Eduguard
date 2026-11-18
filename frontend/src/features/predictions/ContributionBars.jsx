import React from "react";
import { featureLabel } from "./featureLabels";

export function ContributionBars({ contributions = [] }) {
  if (!contributions?.length) return null;

  // Find maximum absolute contribution for normalized bar widths
  const max = Math.max(
    ...contributions.map((c) => Math.abs(c.contribution)),
    0.01,
  );
  const sorted = [...contributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 8);

  const formatValue = (c) => {
    if (c.value === null || c.value === undefined) return "No data (default)";
    if (Number.isInteger(c.value)) return String(c.value);
    return Number(c.value).toFixed(1);
  };

  return (
    <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-5 mb-6">
      <div className="mb-4">
        <h3 className="text-xs font-bold  text-slate-800 flex items-center justify-between">
          <span>Mathematical Feature Contributions</span>
          <span className="text-[11px] font-mono text-slate-500 font-normal">
            Exact logit identity (coef × standardized value)
          </span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Bar direction indicates whether the factor pushes the risk probability
          higher (right / crimson) or lower (left / emerald).
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map((item) => {
          const raises = item.contribution > 0;
          const pctWidth = Math.max(
            (Math.abs(item.contribution) / max) * 48,
            2,
          );

          return (
            <div
              key={item.name}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
            >
              <div className="sm:w-56 shrink-0">
                <span
                  className="font-medium text-slate-800 font-sans block truncate"
                  title={featureLabel(item.name)}
                >
                  {featureLabel(item.name)}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Observed: {formatValue(item)}
                </span>
              </div>

              {/* Diverging Bar Track */}
              <div className="flex-1 flex items-center relative h-5 bg-slate-200/60 rounded-sm overflow-hidden px-1">
                {/* Center dividing mark */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400/50 z-10" />

                {/* Left/Right Bar */}
                <div
                  className={`absolute top-1 bottom-1 rounded-xs transition-all ${
                    raises ? "bg-red-500/90" : "bg-emerald-500/90"
                  }`}
                  style={
                    raises
                      ? { left: "50%", width: `${pctWidth}%` }
                      : { right: "50%", width: `${pctWidth}%` }
                  }
                />
              </div>

              <div className="sm:w-16 text-right font-mono text-xs font-bold shrink-0">
                <span className={raises ? "text-red-700" : "text-emerald-700"}>
                  {raises ? "+" : "−"}
                  {Math.abs(item.contribution).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-200/70 text-[11px] font-mono text-slate-400 uppercase">
        <span>← Mitigates Risk</span>
        <span>Increases Risk →</span>
      </div>
    </div>
  );
}
