import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTeacherClasses } from "@/features/classes/hooks";
import { interventionApi } from "@/features/interventions/api";
import { InterventionCard } from "@/features/interventions/InterventionCard";
import { PageHeader } from "@/components/common/domain";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import { courseLabel } from "@/lib/utils";
export default function Interventions() {
  const classes = useTeacherClasses();
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");
  const plans = useQuery({
    queryKey: ["teacher", "interventions", course, status],
    queryFn: ({ signal }) => interventionApi.all(course, status, signal),
  });
  return (
    <>
      <PageHeader
        eyebrow="Thoughtful follow-through"
        title="Support plans"
        description="Review upcoming check-ins and keep support moving forward."
      />
      <div className="panel table-tools">
        <select
          aria-label="Filter plans by course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">All assigned courses</option>
          {classes.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {courseLabel(c)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter plans by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["planned", "active", "completed", "cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      {classes.error && (
        <ErrorState
          error={classes.error}
          retry={() => {
            void classes.refetch();
          }}
        />
      )}
      {plans.isPending ? (
        <LoadingSkeleton />
      ) : plans.error ? (
        <ErrorState
          error={plans.error}
          retry={() => {
            void plans.refetch();
          }}
        />
      ) : plans.data.length ? (
        <div className="stack">
          {plans.data.map((plan) => (
            <div key={plan.id}>
              <Link
                className="back-link"
                to={`/teacher/students/${plan.student_id}?course=${plan.course_offering_id}`}
              >
                Open student overview →
              </Link>
              <InterventionCard plan={plan} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No plans match this view"
          description="Create a plan from a student’s overview or choose another filter."
        />
      )}
    </>
  );
}
