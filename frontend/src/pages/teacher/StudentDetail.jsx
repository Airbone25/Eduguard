import React, { useState, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  History,
  Shield,
  Sparkles,
} from "lucide-react";
import { teacherApi } from "@/lib/api/teacher";
import { predictionsApi } from "@/lib/api/predictions";
import {
  PageHeader,
  MetricCard,
  SupportBadge,
  TrendIndicator,
  GovernanceBanner,
} from "@/components/common/domain";
import { SectionNav } from "@/components/common/SectionNav";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { RiskTrajectoryChart } from "@/components/charts/RiskTrajectoryChart";
import { Insights } from "@/features/predictions/Insights";
import { InterventionWorkspace } from "@/features/interventions/InterventionWorkspace";
import { courseLabel, dateLabel, percent } from "@/lib/utils";

const tabs = [
  "Overview",
  "Academics",
  "Attendance",
  "Assignments",
  "Interventions",
  "History",
];

export default function StudentDetail() {
  const { studentId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") || "";

  const [tab, setTab] = useState("Overview");
  const [student, setStudent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [progress, setProgress] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStudentData = async (activeCourseId) => {
    setError(null);
    try {
      const [sRes, clsRes] = await Promise.all([
        teacherApi.student(studentId),
        teacherApi.classes(),
      ]);
      setStudent(sRes);
      setClasses(clsRes || []);

      const cId = activeCourseId || courseId || clsRes?.[0]?.id || "";
      if (cId && cId !== courseId) {
        setParams({ course: cId });
      }

      if (cId) {
        const [progRes, predsRes, fcRes] = await Promise.all([
          teacherApi.progress(studentId, cId).catch(() => null),
          predictionsApi.list(studentId, cId).catch(() => []),
          predictionsApi.forecast(studentId, cId).catch(() => null),
        ]);
        setProgress(progRes);
        setPredictions(predsRes || []);
        setForecast(fcRes);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData(courseId);
  }, [studentId, courseId]);

  if (loading) {
    return <LoadingSkeleton label="Retrieving student observation stream…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={() => loadStudentData(courseId)} />;
  }

  const courseRecord =
    progress?.courses?.find((c) => c.course.id === courseId) ||
    progress?.courses?.[0];
  const latestPrediction = predictions?.[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/teacher/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft size={13} />
          <span>Back to overview</span>
        </Link>

        <PageHeader
          title={
            student
              ? `${student.user?.first_name} ${student.user?.last_name}`
              : "Student Profile"
          }
          description={
            student
              ? `Roll Number: ${student.roll_number} · ${student.grade_label} · Record: ${student.id.slice(0, 8)}`
              : ""
          }
          badge={
            latestPrediction ? (
              <SupportBadge level={latestPrediction.support_level} />
            ) : null
          }
        >
          {/* Course Context Picker */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono">
              Course:
            </span>
            <select
              aria-label="Choose a course for this student"
              value={courseId}
              onChange={(e) => setParams({ course: e.target.value })}
              className="text-xs font-bold text-slate-800 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </PageHeader>
      </div>

      <GovernanceBanner />

      <SectionNav
        items={tabs}
        value={tab}
        onChange={setTab}
        label="Student profile sections"
      />

      {tab === "Overview" && (
        <div className="space-y-6">
          {/* Key Observation Metrics */}
          {courseRecord && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                title="Recorded Attendance"
                value={percent(courseRecord.attendance?.current)}
                detail={`4-week trajectory: ${courseRecord.attendance?.change_4wk !== null ? (courseRecord.attendance?.change_4wk > 0 ? `+${courseRecord.attendance?.change_4wk}%` : `${courseRecord.attendance?.change_4wk}%`) : "Stable"}`}
                tone={
                  courseRecord.attendance?.current < 75
                    ? "critical"
                    : courseRecord.attendance?.current < 90
                      ? "warning"
                      : "success"
                }
                icon={<CalendarCheck size={18} />}
              />
              <MetricCard
                title="Assessment Average"
                value={percent(courseRecord.academic?.current)}
                detail={`4-week trajectory: ${courseRecord.academic?.change_4wk !== null ? (courseRecord.academic?.change_4wk > 0 ? `+${courseRecord.academic?.change_4wk} pts` : `${courseRecord.academic?.change_4wk} pts`) : "Stable"}`}
                tone={
                  courseRecord.academic?.current < 60
                    ? "critical"
                    : courseRecord.academic?.current < 75
                      ? "warning"
                      : "success"
                }
                icon={<BookOpen size={18} />}
              />
              <MetricCard
                title="Assignment Completion"
                value={
                  courseRecord.assignments?.completed !== null &&
                  courseRecord.assignments?.total !== null
                    ? `${courseRecord.assignments.completed} / ${courseRecord.assignments.total}`
                    : "—"
                }
                detail={`${percent(courseRecord.assignments?.completion_percent)} completion rate`}
                icon={<ClipboardCheck size={18} />}
              />
            </div>
          )}

          {/* Temporal Trajectory & Forecast Chart */}
          <RiskTrajectoryChart predictions={predictions} forecast={forecast} />

          {/* Explainable Mathematical Insights & Counterfactual What-If Simulation */}
          <Insights
            studentId={studentId}
            courseId={courseId}
            prediction={latestPrediction}
            onRefresh={() => loadStudentData(courseId)}
          />
        </div>
      )}

      {tab === "Academics" && (
        <ProgressChart weeks={courseRecord?.weeks || []} metric="score" />
      )}

      {tab === "Attendance" && (
        <ProgressChart weeks={courseRecord?.weeks || []} metric="attendance" />
      )}

      {tab === "Assignments" && (
        <ProgressChart weeks={courseRecord?.weeks || []} metric="assignments" />
      )}

      {tab === "Interventions" && (
        <InterventionWorkspace
          studentId={studentId}
          courseId={courseId}
          prediction={latestPrediction}
          progress={courseRecord}
        />
      )}

      {tab === "History" && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-bold  text-slate-700 mb-3 flex items-center gap-1.5">
            <History size={14} />
            <span>Historical Prediction Log</span>
          </h3>

          {predictions?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3">Records Through</th>
                    <th className="py-2.5 px-3">Risk Probability</th>
                    <th className="py-2.5 px-3">Support Level</th>
                    <th className="py-2.5 px-3">Model Pipeline</th>
                    <th className="py-2.5 px-3">Generated At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {predictions.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">{dateLabel(p.as_of_date)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {Math.round((p.risk_probability || 0) * 100)}%
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <SupportBadge level={p.support_level} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {p.model_version || "v2.1"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(p.created_at || Date.now()).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No historical predictions"
              description="Historical logs appear here whenever you recalculate signals."
            />
          )}
        </div>
      )}
    </div>
  );
}
