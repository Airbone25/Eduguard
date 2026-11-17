import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { SupportBadge } from "@/components/common/domain";
import type { Prediction, WhatIfResult } from "@/types/support";

interface SimulationSlider {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

const sliders: SimulationSlider[] = [
  { name: "Attendance_Percent", label: "Attendance %", min: 0, max: 100, step: 1 },
  { name: "Avg_Score", label: "Average score", min: 0, max: 100, step: 1 },
  { name: "Assignment_Avg_Score", label: "Assignment avg", min: 0, max: 100, step: 1 },
  { name: "Quiz_Avg_Score", label: "Quiz avg", min: 0, max: 100, step: 1 },
  { name: "Study_Hours_Weekly", label: "Study hours / week", min: 0, max: 40, step: 0.5 },
  { name: "Late_Submissions", label: "Late submissions", min: 0, max: 20, step: 1 },
];

function currentValue(prediction: Prediction, name: string, slider: SimulationSlider) {
  const contribution = prediction.contributions?.find((c) => c.name === name);
  if (contribution?.value !== null && contribution?.value !== undefined) {
    return Math.min(slider.max, Math.max(slider.min, contribution.value));
  }
  return slider.min + (slider.max - slider.min) / 2;
}

export function WhatIfPanel({ prediction }: { prediction: Prediction }) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: Record<string, number>) =>
      api<WhatIfResult>("/teacher/predictions/what-if", {
        method: "POST",
        body: JSON.stringify({ prediction_id: prediction.id, overrides: payload }),
      }),
    onSuccess: setResult,
  });

  useEffect(() => {
    if (!Object.keys(overrides).length) {
      setResult(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => mutation.mutate(overrides), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  if (!prediction.contributions?.length) return null;
  const changed = Object.keys(overrides).length > 0;

  return (
    <div className="whatif-block" aria-label="What-if simulator">
      <h3>What-if simulator</h3>
      <p className="body-copy">
        Move a factor to see how the risk probability would respond. This is a
        simulation only — nothing is saved, and no school record is changed.
      </p>
      <div className="whatif-sliders">
        {sliders.map((slider) => {
          const base = currentValue(prediction, slider.name, slider);
          const value = overrides[slider.name] ?? base;
          return (
            <label key={slider.name} className="whatif-slider">
              <span>
                {slider.label}
                <strong>
                  {value}
                  {value !== base ? ` (was ${base})` : ""}
                </strong>
              </span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={value}
                aria-label={`Simulate ${slider.label}`}
                onChange={(event) =>
                  setOverrides((current) => ({
                    ...current,
                    [slider.name]: Number(event.target.value),
                  }))
                }
              />
            </label>
          );
        })}
      </div>
      {mutation.error && (
        <p className="error-text" role="alert">
          The simulation failed. Adjust the values and try again.
        </p>
      )}
      {changed && result && (
        <div className="whatif-result" role="status">
          <SupportBadge level={result.support_level} />
          <span>
            Probability {result.baseline_probability.toFixed(2)} →{" "}
            <strong>{result.probability.toFixed(2)}</strong>{" "}
            {result.delta > 0 ? "▲" : result.delta < 0 ? "▼" : "·"}{" "}
            {result.delta >= 0 ? "+" : "−"}
            {Math.abs(result.delta).toFixed(2)}
          </span>
        </div>
      )}
      {changed && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setOverrides({});
            mutation.reset();
          }}
        >
          Reset simulation
        </button>
      )}
    </div>
  );
}
