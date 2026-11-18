import React, { useState, useEffect, useRef } from "react";
import { Sliders, RotateCcw, Sparkles } from "lucide-react";
import { SupportBadge } from "@/components/common/domain";
import { predictionsApi } from "@/lib/api/predictions";

const sliders = [
  {
    name: "Attendance_Percent",
    label: "Attendance %",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
  },
  {
    name: "Avg_Score",
    label: "Average Score",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
  },
  {
    name: "Assignment_Avg_Score",
    label: "Assignment Avg",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
  },
  {
    name: "Quiz_Avg_Score",
    label: "Quiz Avg",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
  },
  {
    name: "Study_Hours_Weekly",
    label: "Study Hours / Wk",
    min: 0,
    max: 40,
    step: 0.5,
    unit: " hrs",
  },
  {
    name: "Late_Submissions",
    label: "Late Submissions",
    min: 0,
    max: 20,
    step: 1,
    unit: "",
  },
];

function currentValue(prediction, name, slider) {
  const contribution = prediction.contributions?.find((c) => c.name === name);
  if (contribution?.value !== null && contribution?.value !== undefined) {
    return Math.min(slider.max, Math.max(slider.min, contribution.value));
  }
  return slider.min + (slider.max - slider.min) / 2;
}

export function WhatIfPanel({ prediction }) {
  const [overrides, setOverrides] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setResult(null);
    if (!Object.keys(overrides).length) {
      setResult(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await predictionsApi.whatIf(prediction.id, overrides);
        if (!cancelled) setResult(res);
      } catch (err) {
        if (!cancelled)
          setError(
            err.message ||
              "The simulation could not be completed. Adjust a value to try again.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [overrides, prediction.id]);

  if (!prediction?.contributions?.length) return null;

  const changed = Object.keys(overrides).length > 0;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-amber-500/15 text-amber-700">
            <Sliders size={15} />
          </span>
          <h3 className="text-xs font-bold  text-amber-950">
            Explore a change
          </h3>
        </div>
        {changed && (
          <button
            type="button"
            onClick={() => setOverrides({})}
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset sliders</span>
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed mb-4">
        Simulate academic adjustments without affecting actual historical
        records. See how changes in attendance, assignment completion, or study
        hours shift the model’s risk probability.
      </p>

      {loading && (
        <p role="status" className="form-notice">
          Calculating this scenario…
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {/* Sliders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sliders.map((s) => {
          const base = currentValue(prediction, s.name, s);
          const current = overrides[s.name] ?? base;
          const isModified =
            overrides[s.name] !== undefined && overrides[s.name] !== base;

          return (
            <div
              key={s.name}
              className="p-3 bg-white border border-slate-200/90 rounded-lg shadow-2xs"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">{s.label}</span>
                <span className="font-mono font-bold text-slate-900">
                  {current}
                  {s.unit}
                  {isModified && (
                    <span className="ml-1 text-[11px] text-amber-700 font-normal">
                      (was {base})
                    </span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={current}
                onChange={(e) =>
                  setOverrides((prev) => ({
                    ...prev,
                    [s.name]: Number(e.target.value),
                  }))
                }
                className="w-full accent-amber-600 cursor-pointer"
                aria-label={`Simulate ${s.label}`}
              />
            </div>
          );
        })}
      </div>

      {/* Real-time simulation feedback banner */}
      {changed && (
        <div className="mt-4 p-3 bg-white border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600">
              Projected Support Level:
            </span>
            {result ? (
              <SupportBadge level={result.support_level} />
            ) : (
              <span className="text-xs text-slate-400">Computing…</span>
            )}
          </div>

          <div className="font-mono text-xs text-slate-800">
            {result ? (
              <span>
                Baseline {(result.baseline_probability * 100).toFixed(0)}% →{" "}
                <strong className="text-sm">
                  {(result.probability * 100).toFixed(0)}%
                </strong>{" "}
                <span
                  className={
                    result.delta < 0
                      ? "text-emerald-600 font-bold"
                      : result.delta > 0
                        ? "text-red-600 font-bold"
                        : "text-slate-600"
                  }
                >
                  ({result.delta > 0 ? "+" : ""}
                  {(result.delta * 100).toFixed(0)} pts)
                </span>
              </span>
            ) : (
              <span>Updating model simulation…</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
