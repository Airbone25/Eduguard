import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  CheckCheck,
  Flame,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/features/auth/context";
import { useStudentDashboard, achievements } from "@/features/progress/student";
import { StudentSupport } from "@/features/progress/StudentSupport";
import { PageHeader, MetricCard } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { Button } from "@/components/ui/button";
import { percent } from "@/lib/utils";
export default function StudentDashboard() {
  const { user } = useAuth();
  const query = useStudentDashboard();
  const [id, setId] = useState("");
  if (query.isPending) return <LoadingSkeleton />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const data = query.data;
  const course =
    data.courses.find((c) => c.course.id === id) ?? data.courses[0];
  const highlights = course ? achievements(course) : [];
  const plans = data.visible_interventions.filter(
    (p) => p.course_offering_id === course?.course.id,
  );
  return (
    <>
      <PageHeader
        title={`You’ve got this, ${user?.first_name ?? "learner"}.`}
        description="Small steps add up. Here’s how your learning is taking shape."
      />
      {!course ? (
        <EmptyState
          title="Your learning journey starts here"
          description="Once your school enrolls you in a course, your progress will appear here."
        />
      ) : (
        <>
          <label className="course-toolbar">
            Your course
            <select
              value={course.course.id}
              onChange={(e) => setId(e.target.value)}
            >
              {data.courses.map((c) => (
                <option key={c.course.id} value={c.course.id}>
                  {c.course.subject_name} · {c.course.classroom_name}
                </option>
              ))}
            </select>
          </label>
          <div className="metric-grid student-metrics">
            <MetricCard
              title="Attendance"
              value={percent(course.attendance.current)}
              detail="This week"
              icon={<CalendarCheck />}
            />
            <MetricCard
              title="Average Score"
              value={percent(course.academic.current)}
              detail="This week’s assessments"
              icon={<BookOpen />}
            />
            <MetricCard
              title="Assignments"
              value={percent(course.assignments.completion_percent)}
              detail="Completed this week"
              icon={<CheckCheck />}
            />
            <MetricCard
              title="On-time Streak"
              value={course.assignments.on_time_streak_weeks ?? "—"}
              detail="Consecutive recorded weeks"
              icon={<Flame />}
            />
          </div>
          <p className="data-note">
            A dash means a measurement isn’t available yet.
          </p>
          <ProgressChart weeks={course.weeks} asOf={data.as_of_date} />
          <section className="panel padded">
            <h2>Improvement highlights</h2>
            {highlights.length ? (
              <div className="recommendation-grid">
                {highlights.map((h) => (
                  <article className="achievement" key={h.title}>
                    <Sparkles aria-hidden="true" />
                    <h3>{h.title}</h3>
                    <p>{h.detail}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p>
                Keep showing up. Your highlights will appear as more progress is
                recorded.
              </p>
            )}
          </section>
          <section className="support-note">
            <BookOpen />
            <div>
              <h2>Focus this week</h2>
              <p>
                {plans.find(
                  (p) => p.status === "active" || p.status === "planned",
                )?.title ??
                  "Choose one small learning task and check in with your teacher about your next step."}
              </p>
              <Button variant="outline" asChild>
                <Link to="/student/goals">See my goals</Link>
              </Button>
            </div>
          </section>
          <section className="stack">
            <h2>Support for your next step</h2>
            {plans.length ? (
              plans.map((p) => (
                <StudentSupport key={p.id} plan={p} course={course} />
              ))
            ) : (
              <p>
                No shared support plans yet. Your teacher is here to help when
                you need it.
              </p>
            )}
            <Link to="/student/support">View all shared support plans</Link>
          </section>
        </>
      )}
    </>
  );
}
