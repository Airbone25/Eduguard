import React, { useState, useEffect } from "react";
import { Plus, Sparkles } from "lucide-react";
import { interventionApi } from "@/lib/api/interventions";
import { InterventionCard } from "./InterventionCard";
import { InterventionEditor } from "./InterventionEditor";
import { LoadingSkeleton, EmptyState } from "@/components/common/states";

export function InterventionWorkspace({
  studentId,
  courseId,
  prediction,
  progress,
}) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState(null);

  const fetchPlans = async () => {
    try {
      const data = await interventionApi.list(studentId, courseId);
      setPlans(data || []);
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [studentId, courseId]);

  return (
    <div className="space-y-6">
      {/* Recommended Next Steps from Prediction */}
      {prediction?.recommendations?.length ? (
        <section className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-amber-600" />
            <h3 className="text-xs font-bold  text-amber-950">
              Suggested next steps
            </h3>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Suggested based on primary temporal factors driving this student’s
            risk probability.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {prediction.recommendations.map((rec) => (
              <div
                key={rec.template_id}
                className="p-4 bg-white border border-amber-200/80 rounded-lg flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">
                    {rec.name}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    {rec.reason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTemplate(rec.template_id)}
                  className="self-start px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  Use this plan
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Existing Plans Header & Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Support plans</h3>
          <p className="text-xs text-slate-500">
            Structured intervention timeline and goal tracking for this course.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTemplate("")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={14} />
          <span>Create a plan</span>
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton label="Loading support plans…" />
      ) : plans.length ? (
        <div className="space-y-4">
          {plans.map((plan) => (
            <InterventionCard
              key={plan.id}
              plan={plan}
              progress={progress}
              onRefresh={fetchPlans}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No support plans created yet"
          description="Initiate a plan based on the recommendation above or create a support plan."
        />
      )}

      {activeTemplate !== null && (
        <InterventionEditor
          studentId={studentId}
          courseId={courseId}
          prediction={prediction}
          templateId={activeTemplate}
          onClose={() => setActiveTemplate(null)}
          onSaved={fetchPlans}
        />
      )}
    </div>
  );
}
