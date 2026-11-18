import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  FileSpreadsheet,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { teacherApi } from "@/lib/api/teacher";
import { interventionApi } from "@/lib/api/interventions";
import { PageHeader } from "@/components/common/domain";
import { SectionNav } from "@/components/common/SectionNav";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { DistributionChart } from "@/components/charts/DistributionChart";
import { InterventionCard } from "@/features/interventions/InterventionCard";
import { courseLabel } from "@/lib/utils";

const tabs = [
  "Students",
  "Performance",
  "Attendance",
  "Assignments",
  "Interventions",
];

export default function ClassAnalytics() {
  const { courseId = "" } = useParams();
  const [tab, setTab] = useState("Students");
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [plans, setPlans] = useState([]);
  const [progressList, setProgressList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setError(null);
    try {
      const [cls, stus, sum, plns] = await Promise.all([
        teacherApi.classes(),
        teacherApi.students(courseId),
        teacherApi.summary(courseId).catch(() => null),
        interventionApi.all(courseId, "").catch(() => []),
      ]);
      setClasses(cls || []);
      setStudents(stus || []);
      setSummary(sum);
      setPlans(plns || []);

      // If we need weekly averages, fetch student progress sample
      if (stus?.length) {
        const progSamples = await Promise.all(
          stus
            .slice(0, 5)
            .map((s) => teacherApi.progress(s.id, courseId).catch(() => null)),
        );
        setProgressList(progSamples.filter(Boolean));
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId]);

  if (loading) {
    return <LoadingSkeleton label="Aggregating class metrics…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  const course = classes.find((c) => c.id === courseId) || { id: courseId };
  const values = summary?.students || [];

  // Compute aggregate weekly rows from sampled progress
  const aggregateWeeks = progressList[0]?.courses?.[0]?.weeks || [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/teacher/classes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft size={13} />
          <span>Back to Assigned Classes</span>
        </Link>
        <PageHeader
          title={courseLabel(course)}
          description="Class-wide distribution of academic performance, attendance resilience, and active support plans."
        >
          <Link
            to={`/teacher/classes/${courseId}/weekly`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet size={14} />
            <span>Enter Weekly Records</span>
          </Link>
        </PageHeader>
      </div>

      <SectionNav
        items={tabs}
        value={tab}
        onChange={setTab}
        label="Analytics views"
      />

      {tab === "Students" && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold  text-slate-600 flex items-center gap-2">
              <Users size={14} />
              <span>Enrolled Students ({students.length})</span>
            </h3>
          </div>

          {students.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {students.map((s) => (
                <Link
                  key={s.id}
                  to={`/teacher/students/${s.id}?course=${encodeURIComponent(courseId)}`}
                  className="p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-300 rounded-lg flex items-center justify-between transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-mono text-xs font-bold flex items-center justify-center">
                      {s.user?.first_name?.[0] || "S"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-snug">
                        {s.user?.first_name} {s.user?.last_name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {s.roll_number} · {s.grade_label}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-slate-400" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No enrolled students"
              description="Your administrator can enroll students into this course offering."
            />
          )}
        </div>
      )}

      {tab === "Performance" && (
        <div className="space-y-6">
          <DistributionChart
            title="Class Support Tier Distribution"
            values={[
              {
                name: "Priority Support",
                count: summary?.counts?.priority_support || 0,
              },
              { name: "Watch", count: summary?.counts?.watch || 0 },
              { name: "Doing Well", count: summary?.counts?.doing_well || 0 },
              {
                name: "Not Assessed",
                count: summary?.counts?.not_assessed || 0,
              },
            ]}
          />
          <ProgressChart weeks={aggregateWeeks} metric="score" />
        </div>
      )}

      {tab === "Attendance" && (
        <div className="space-y-6">
          <DistributionChart
            title="Attendance Bracket Distribution"
            values={[
              {
                name: "< 75% Critical",
                count: values.filter(
                  (s) => s.attendance !== null && s.attendance < 75,
                ).length,
              },
              {
                name: "75–89% Watch",
                count: values.filter(
                  (s) =>
                    s.attendance !== null &&
                    s.attendance >= 75 &&
                    s.attendance < 90,
                ).length,
              },
              {
                name: "90–100% Solid",
                count: values.filter(
                  (s) => s.attendance !== null && s.attendance >= 90,
                ).length,
              },
              {
                name: "Missing Data",
                count: values.filter((s) => s.attendance === null).length,
              },
            ]}
          />
          <ProgressChart weeks={aggregateWeeks} metric="attendance" />
        </div>
      )}

      {tab === "Assignments" && (
        <div className="space-y-6">
          <ProgressChart weeks={aggregateWeeks} metric="assignments" />
        </div>
      )}

      {tab === "Interventions" && (
        <div>
          {plans.length ? (
            <div className="space-y-4">
              {plans.map((p) => (
                <InterventionCard key={p.id} plan={p} onRefresh={loadData} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active support plans in this course"
              description="Open a student's profile to create a tailored support intervention."
            />
          )}
        </div>
      )}
    </div>
  );
}
