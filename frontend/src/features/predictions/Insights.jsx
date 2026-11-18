import React, { useState } from "react";
import { Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { SupportBadge } from "@/components/common/domain";
import { ContributionBars } from "./ContributionBars";
import { WhatIfPanel } from "./WhatIfPanel";
import { predictionsApi } from "@/lib/api/predictions";
import { dateLabel } from "@/lib/utils";

export function Insights({ studentId, courseId, prediction, onRefresh }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await predictionsApi.predict(
        studentId,
        courseId,
        new Date().toISOString().slice(0, 10),
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err?.message || "Could not generate insight");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Advisory Signal & Model Explanation
            </h2>
            {prediction && <SupportBadge level={prediction.support_level} />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {prediction
              ? `Derived from weekly observations through ${dateLabel(prediction.as_of_date)} · Model ${prediction.model_version || "v2.1"}`
              : "Generate an explainable risk prediction from recorded observations."}
          </p>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-2xs hover:bg-slate-50 disabled:opacity-50 cursor-pointer transition-colors"
        >
          <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
          <span>{generating ? "Computing…" : "Recalculate Signal"}</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200"
        >
          {error}
        </div>
      )}

      {prediction ? (
        <div>
          {/* Signal Bullet Points */}
          {prediction.signals?.length ? (
            <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200/70 rounded-lg">
              <h4 className="text-[11px] font-bold  text-slate-500 mb-2">
                Identified Temporal Triggers
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {prediction.signals.map((sig, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{sig.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Feature Contribution Bars */}
          <ContributionBars contributions={prediction.contributions} />

          {/* Interactive What-If Simulation */}
          <WhatIfPanel prediction={prediction} />
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 border border-slate-200/80 rounded-lg text-slate-500 text-xs">
          No saved prediction for this course offering yet. Click "Recalculate
          Signal" above.
        </div>
      )}
    </div>
  );
}
