import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  useClassSummary,
  useTeacherClasses,
  useTeacherClassStudents,
} from "@/features/classes/hooks";
import { teacherApi } from "@/lib/api/teacher";
import { mapLimited } from "@/lib/api/pagination";
import { interventionApi } from "@/features/interventions/api";
import { InterventionCard } from "@/features/interventions/InterventionCard";
import { PageHeader } from "@/components/common/domain";
import { SectionNav } from "@/components/common/SectionNav";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { Button } from "@/components/ui/button";
import { courseLabel } from "@/lib/utils";
import { today } from "@/features/progress/metrics";
import type { CourseProgress } from "@/types/api";
const tabs = [
  "Students",
  "Performance",
  "Attendance",
  "Assignments",
  "Interventions",
] as const;
export default function ClassAnalytics() {
  const { courseId = "" } = useParams();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Students");
  const roster = useTeacherClassStudents(courseId);
  const classes = useTeacherClasses();
  const summary = useClassSummary(courseId, "attention");
  const history = useQuery({
    queryKey: ["teacher", "class", courseId, "analytics"],
    queryFn: ({ signal }) =>
      mapLimited(
        roster.data ?? [],
        (s) => teacherApi.progress(s.id, courseId, signal),
        signal,
      ),
    enabled: Boolean(
      roster.data && ["Performance", "Attendance", "Assignments"].includes(tab),
    ),
  });
  const plans = useQuery({
    queryKey: ["teacher", "interventions", courseId, ""],
    queryFn: ({ signal }) => interventionApi.all(courseId, "", signal),
    enabled: tab === "Interventions",
  });
  const course = classes.data?.find((c) => c.id === courseId);
  const grouped = new Map<string, CourseProgress["weeks"]>();
  history.data
    ?.flatMap((p) => p.courses.flatMap((c) => c.weeks))
    .forEach((week) =>
      grouped.set(week.week_start, [
        ...(grouped.get(week.week_start) ?? []),
        week,
      ]),
    );
  const mean = (values: (number | null)[]) => {
    const known = values.filter((v): v is number => v !== null);
    return known.length
      ? known.reduce((a, b) => a + b, 0) / known.length
      : null;
  };
  const aggregate: CourseProgress["weeks"] = [...grouped].map(
    ([week_start, rows]) => ({
      week_start,
      assessment_avg_score: mean(rows.map((r) => r.assessment_avg_score)),
      attendance_percent: mean(rows.map((r) => r.attendance_percent)),
      assignment_count: rows.every((r) => r.assignment_count !== null)
        ? rows.reduce((a, r) => a + r.assignment_count!, 0)
        : null,
      assignments_completed: rows.every((r) => r.assignments_completed !== null)
        ? rows.reduce((a, r) => a + r.assignments_completed!, 0)
        : null,
      late_submissions: null,
    }),
  );
  const values = summary.data?.students ?? [];
  return (
    <>
      <Link className="back-link" to="/teacher/classes">
        ← Back to my classes
      </Link>
      <PageHeader
        eyebrow="Class overview"
        title={course ? courseLabel(course) : `Course ${courseId.slice(0, 8)}`}
        description="Understand progress across your class without ranking students."
      >
        <Button asChild>
          <Link to={`/teacher/classes/${courseId}/weekly`}>
            Enter weekly records
          </Link>
        </Button>
      </PageHeader>
      <SectionNav
        items={tabs}
        value={tab}
        onChange={setTab}
        label="Class sections"
      />
      {roster.isPending ? (
        <LoadingSkeleton />
      ) : roster.error ? (
        <ErrorState
          error={roster.error}
          retry={() => {
            void roster.refetch();
          }}
        />
      ) : tab === "Students" ? (
        <section className="panel">
          <div className="section-heading">
            <h2>{roster.data.length} students</h2>
          </div>
          {roster.data.length ? (
            <ul className="roster-list">
              {roster.data.map((s) => (
                <li key={s.id}>
                  <Link to={`/teacher/students/${s.id}?course=${courseId}`}>
                    <span className="student-avatar">
                      {s.user.first_name[0]}
                    </span>
                    <span>
                      <strong>
                        {s.user.first_name} {s.user.last_name}
                      </strong>
                      <small>
                        {s.roll_number} · {s.grade_label}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No students enrolled"
              description="Your administrator can enroll students in this course."
            />
          )}
        </section>
      ) : tab === "Interventions" ? (
        plans.isPending ? (
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
            {plans.data.map((p) => (
              <InterventionCard key={p.id} plan={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No support plans"
            description="Create a plan from a student’s overview."
          />
        )
      ) : history.isPending ? (
        <LoadingSkeleton label="Loading class history" />
      ) : history.error ? (
        <ErrorState
          error={history.error}
          retry={() => {
            void history.refetch();
          }}
        />
      ) : (
        <>
          <p className="body-copy">
            Scores and attendance show the mean of students with measurements
            each week. Assignment totals are shown only when all reported rows
            have counts. Missing student records are not zeroes.
          </p>
          <ProgressChart
            weeks={aggregate}
            asOf={today()}
            metric={
              tab === "Attendance"
                ? "attendance"
                : tab === "Assignments"
                  ? "assignments"
                  : "score"
            }
          />
          {summary.error ? (
            <ErrorState
              error={summary.error}
              retry={() => {
                void summary.refetch();
              }}
            />
          ) : summary.isPending ? (
            <LoadingSkeleton />
          ) : tab === "Attendance" ? (
            <DistributionChart
              title="Current attendance distribution"
              values={[
                {
                  name: "Below 75%",
                  count: values.filter(
                    (s) => s.attendance !== null && s.attendance < 75,
                  ).length,
                },
                {
                  name: "75–89%",
                  count: values.filter(
                    (s) =>
                      s.attendance !== null &&
                      s.attendance >= 75 &&
                      s.attendance < 90,
                  ).length,
                },
                {
                  name: "90–100%",
                  count: values.filter(
                    (s) => s.attendance !== null && s.attendance >= 90,
                  ).length,
                },
                {
                  name: "Missing",
                  count: values.filter((s) => s.attendance === null).length,
                },
              ]}
            />
          ) : (
            tab === "Performance" && (
              <DistributionChart
                title="Support distribution"
                values={[
                  {
                    name: "Priority",
                    count: summary.data.counts.priority_support,
                  },
                  { name: "Watch", count: summary.data.counts.watch },
                  { name: "Doing Well", count: summary.data.counts.doing_well },
                  {
                    name: "Not assessed",
                    count: summary.data.counts.not_assessed,
                  },
                ]}
              />
            )
          )}
        </>
      )}
    </>
  );
}
