import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SectionNav } from "@/components/common/SectionNav";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { RiskTrajectoryChart } from "@/components/charts/RiskTrajectoryChart";
import { Insights } from "@/features/predictions/Insights";
import { usePredictions, latestPrediction, useForecast } from "@/features/predictions/hooks";
import { SupportBadge, TrendIndicator } from "@/components/common/domain";
import { InterventionWorkspace } from "@/features/interventions/InterventionWorkspace";
import { BookOpen, CalendarCheck, ClipboardCheck } from "lucide-react";
import {
  useStudentDetails,
  useStudentProgress,
  useTeacherClasses,
} from "@/features/classes/hooks";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import { MetricCard, PageHeader } from "@/components/common/domain";
import { courseLabel, dateLabel, percent } from "@/lib/utils";
import { useSetSignalBand } from "@/stores/signalBandStore";

export default function StudentDetail() {
  const { studentId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") ?? "";
  const student = useStudentDetails(studentId);
  const classes = useTeacherClasses();
  const progress = useStudentProgress(studentId, courseId);
  const predictions = usePredictions(studentId, courseId);
  const forecast = useForecast(studentId, courseId);
  const latest = latestPrediction(predictions.data);
  useSetSignalBand({
    label: "Student route",
    detail: latest
      ? "Advisory signal · teacher only · open the explanation before acting"
      : "No saved insight yet · generate one from weekly records",
    value: latest ? `${Math.round(latest.risk_probability * 100)}%` : null,
    targetId: "insight-explanation",
    actionLabel: "Open explanation",
  });
  const tabs = [
    "Overview",
    "Academics",
    "Attendance",
    "Assignments",
    "Interventions",
    "History",
  ] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  if (student.isPending)
    return <LoadingSkeleton label="Loading student profile" />;
  if (student.error)
    return (
      <ErrorState
        error={student.error}
        retry={() => {
          void student.refetch();
        }}
      />
    );
  const s = student.data;
  const record = progress.data?.courses.find((c) => c.course.id === courseId);
  return (
    <>
      <Link className="back-link" to="/teacher/dashboard">
        ← Back to overview
      </Link>
      <PageHeader
        title={`${s.user.first_name} ${s.user.last_name}`}
        description={`Roll number ${s.roll_number} · ${s.grade_label}`}
      />
      <section className="panel profile-context">
        <label htmlFor="student-course">Course context</label>
        <select
          id="student-course"
          value={courseId}
          onChange={(e) => setParams({ course: e.target.value })}
        >
          <option value="">Choose an assigned course</option>
          {classes.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {courseLabel(c)}
            </option>
          ))}
          {courseId && !classes.data?.some((c) => c.id === courseId) && (
            <option value={courseId}>Course {courseId.slice(0, 8)}</option>
          )}
        </select>
        <p>
          Progress is shown only for courses you teach and this student is
          enrolled in.
        </p>
        {classes.error && (
          <ErrorState
            error={classes.error}
            retry={() => {
              void classes.refetch();
            }}
          />
        )}
      </section>
      {!courseId ? (
        <section className="panel">
          <EmptyState
            title="Choose a course to view progress"
            description="Student progress is specific to each course. Select a course above to see available information."
          />
        </section>
      ) : progress.isPending ? (
        <LoadingSkeleton label="Loading course progress" />
      ) : progress.error ? (
        <ErrorState
          error={progress.error}
          retry={() => {
            void progress.refetch();
          }}
        />
      ) : record ? (
        <>
          <div className="section-heading progress-heading">
            <div>
              <h2>
                {record.course.classroom_name} · {record.course.subject_name}
              </h2>
              <p>As of {dateLabel(progress.data.as_of_date)}</p>
            </div>
          </div>
          <div className="detail-status">
            <SupportBadge level={latest?.support_level ?? "not_assessed"} />
            <TrendIndicator trend={record.academic.trend} />
            <span>
              Latest insight:{" "}
              {latest
                ? new Date(latest.created_at).toLocaleString()
                : "Not generated"}
            </span>
          </div>
          <SectionNav
            items={tabs}
            value={tab}
            onChange={setTab}
            label="Student sections"
          />
          {tab === "Overview" && (
            <div className="metric-grid detail-metrics">
              <MetricCard
                title="Attendance"
                value={percent(record.attendance.current)}
                detail="From available weekly records"
                icon={<CalendarCheck size={19} />}
              />
              <MetricCard
                title="Average score"
                value={percent(record.academic.current)}
                detail="From available assessments"
                icon={<BookOpen size={19} />}
              />
              <MetricCard
                title="Assignments"
                value={
                  record.assignments.completed === null ||
                  record.assignments.total === null
                    ? "—"
                    : `${record.assignments.completed} / ${record.assignments.total}`
                }
                detail="Completed / assigned"
                icon={<ClipboardCheck size={19} />}
              />
            </div>
          )}
          {tab !== "History" && tab !== "Interventions" && (
            <ProgressChart
              weeks={record.weeks}
              asOf={progress.data.as_of_date}
              metric={
                tab === "Attendance"
                  ? "attendance"
                  : tab === "Assignments"
                    ? "assignments"
                    : "score"
              }
            />
          )}
          {tab === "Interventions" && (
            <InterventionWorkspace
              key={`${studentId}-${courseId}`}
              studentId={studentId}
              courseId={courseId}
              prediction={latest}
              progress={record}
            />
          )}
          {tab === "Overview" &&
            (predictions.isPending ? (
              <LoadingSkeleton label="Loading insights" />
            ) : predictions.error ? (
              <ErrorState
                error={predictions.error}
                retry={() => {
                  void predictions.refetch();
                }}
              />
            ) : (
              <>
                <RiskTrajectoryChart
                  predictions={predictions.data ?? []}
                  forecast={forecast.data}
                  forecastError={forecast.error ?? null}
                />
                <Insights
                  studentId={studentId}
                  courseId={courseId}
                  prediction={latest}
                />
              </>
            ))}
          {tab === "History" && (
            <section className="panel padded">
              <h2>Insight history</h2>
              {predictions.error ? (
                <ErrorState
                  error={predictions.error}
                  retry={() => {
                    void predictions.refetch();
                  }}
                />
              ) : predictions.isPending ? (
                <LoadingSkeleton />
              ) : predictions.data?.length ? (
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      Saved prediction history
                    </caption>
                    <thead>
                      <tr>
                        <th>Records through</th>
                        <th>Created</th>
                        <th>Support</th>
                        <th>Model</th>
                        <th>Signals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.data.map((p) => (
                        <tr key={p.id}>
                          <td>{dateLabel(p.as_of_date)}</td>
                          <td>{new Date(p.created_at).toLocaleString()}</td>
                          <td>
                            <SupportBadge level={p.support_level} />
                          </td>
                          <td>{p.model_version}</td>
                          <td>
                            {p.signals.map((s) => s.message).join(" ") ||
                              "No signals"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No saved insights"
                  description="Generated insights will appear here with their original dates and model versions."
                />
              )}
            </section>
          )}
        </>
      ) : (
        <EmptyState
          title="No course progress available"
          description="Choose another assigned course to continue."
        />
      )}
    </>
  );
}
