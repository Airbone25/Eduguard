import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import type { Prediction } from "@/types/support";
import type { CourseProgress } from "@/types/api";
import { useInterventions } from "./api";
import { InterventionEditor } from "./InterventionEditor";
import { InterventionCard } from "./InterventionCard";
export function InterventionWorkspace({
  studentId,
  courseId,
  prediction,
  progress,
}: {
  studentId: string;
  courseId: string;
  prediction?: Prediction;
  progress?: CourseProgress;
}) {
  const plans = useInterventions(studentId, courseId);
  const [template, setTemplate] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  return (
    <div className="stack">
      <section className="panel padded">
        <div className="section-heading compact">
          <div>
            <h2>Recommended next steps</h2>
            <p>
              Choose what fits this student. Suggestions do not create plans
              automatically.
            </p>
          </div>
          <Button onClick={() => setTemplate("")}>Create custom plan</Button>
        </div>
        {prediction?.recommendations.length ? (
          <div className="recommendation-grid">
            {prediction.recommendations.map((r) => (
              <article className="recommendation-card" key={r.template_id}>
                <h3>{r.name}</h3>
                <p>{r.reason}</p>
                <Button
                  variant="outline"
                  onClick={() => setTemplate(r.template_id)}
                >
                  Start intervention
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="body-copy">
            No recommendations available. Generate an insight from weekly
            records or create a plan using your own judgment.
          </p>
        )}
      </section>
      {notice && (
        <p role="status" className="success-message">
          {notice}
        </p>
      )}
      {plans.isPending ? (
        <LoadingSkeleton label="Loading support plans" />
      ) : plans.error ? (
        <ErrorState
          error={plans.error}
          retry={() => {
            void plans.refetch();
          }}
        />
      ) : plans.data.length ? (
        plans.data.map((plan) => (
          <InterventionCard key={plan.id} plan={plan} progress={progress} />
        ))
      ) : (
        <EmptyState
          title="No support plans yet"
          description="Choose a recommendation or create a custom plan to get started."
        />
      )}
      {template !== null && (
        <InterventionEditor
          studentId={studentId}
          courseId={courseId}
          prediction={prediction}
          templateId={template}
          onClose={() => setTemplate(null)}
          onSaved={() => setNotice("Support plan created.")}
        />
      )}
    </div>
  );
}
