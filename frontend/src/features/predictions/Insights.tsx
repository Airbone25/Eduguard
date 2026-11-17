import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/common/states";
import { SupportBadge } from "@/components/common/domain";
import type { Prediction } from "@/types/support";
import { today } from "@/features/progress/metrics";
import { dateLabel } from "@/lib/utils";
import { ContributionBars } from "./ContributionBars";
import { WhatIfPanel } from "./WhatIfPanel";

export function Insights({
  studentId,
  courseId,
  prediction,
}: {
  studentId: string;
  courseId: string;
  prediction?: Prediction;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api<Prediction>(
        `/teacher/students/${encodeURIComponent(studentId)}/predictions`,
        {
          method: "POST",
          body: JSON.stringify({
            course_offering_id: courseId,
            as_of_date: today(),
          }),
        },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["teacher"] }),
  });
  return (
    <section className="panel padded" id="insight-explanation">
      <div className="section-heading compact">
        <div>
          <h2>Why EduGuard flagged this student</h2>
          <p>
            {prediction
              ? `Insight based on records through ${dateLabel(prediction.as_of_date)}`
              : "Create an insight from existing weekly records."}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Generating…" : "Generate insight"}
        </Button>
      </div>
      {mutation.error && (
        <ErrorState error={mutation.error} retry={() => mutation.mutate()} />
      )}
          {prediction ? (
            <>
              <SupportBadge level={prediction.support_level} />
              <ContributionBars contributions={prediction.contributions} />
              {prediction.signals.length ? (
                <ul className="signal-list">
                  {prediction.signals.map((signal) => (
                    <li key={signal.code}>{signal.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="body-copy">
                  No measurable support signals were identified in this snapshot.
                </p>
              )}
              <WhatIfPanel prediction={prediction} />
              <p className="data-note">
                Model {prediction.model_version} · Advisory only. Use your
                professional judgment.
              </p>
            </>
          ) : (
        <EmptyState
          title="No insight generated yet"
          description="Weekly school records are used to calculate support signals. No manual ML features are required."
        />
      )}
    </section>
  );
}
