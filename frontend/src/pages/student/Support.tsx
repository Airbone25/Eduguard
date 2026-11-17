import {
  useStudentDashboard,
  useMySupport,
  achievements,
} from "@/features/progress/student";
import { StudentSupport } from "@/features/progress/StudentSupport";
import { PageHeader } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
export default function Support({ goals = false }: { goals?: boolean }) {
  const dashboard = useStudentDashboard();
  const support = useMySupport();
  if (dashboard.isPending || support.isPending) return <LoadingSkeleton />;
  const error = dashboard.error || support.error;
  if (error)
    return (
      <ErrorState
        error={error}
        retry={() => {
          void dashboard.refetch();
          void support.refetch();
        }}
      />
    );
  const courses = dashboard.data?.courses ?? [];
  const plans =
    support.data?.filter(
      (p) => !goals || Object.values(p.goal_definition).some((v) => v != null),
    ) ?? [];
  return (
    <>
      <PageHeader
        title={goals ? "A little progress, every week." : "Your support plans."}
        description={
          goals
            ? "Follow the goals you’re working on with your teacher."
            : "Shared plans to help you learn with confidence."
        }
      />
      <div className="stack">
        {plans.length ? (
          plans.map((p) => (
            <StudentSupport
              key={p.id}
              plan={p}
              course={courses.find((c) => c.course.id === p.course_offering_id)}
            />
          ))
        ) : (
          <EmptyState
            title={
              goals ? "A fresh start for your goals" : "No shared plans yet"
            }
            description="Talk with your teacher about one small step you’d like to work toward."
          />
        )}
      </div>
      {goals && (
        <section className="panel padded">
          <h2>Your achievements</h2>
          {courses.map((c) => (
            <div key={c.course.id}>
              <h3>{c.course.subject_name}</h3>
              {achievements(c).length ? (
                <ul>
                  {achievements(c).map((a) => (
                    <li key={a.title}>
                      <strong>{a.title}</strong> — {a.detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Every week gives you another chance to build your progress.
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
