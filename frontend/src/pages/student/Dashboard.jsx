import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CalendarCheck,
  CheckCheck,
  Flame,
  Sparkles,
  ArrowRight,
  Target,
} from "lucide-react";
import { studentApi } from "@/lib/api/student";
import { achievements } from "@/features/progress/student";
import { PageHeader, MetricCard } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { ProgressChart } from "@/components/charts/ProgressChart";
import { StudentSupport } from "@/features/progress/StudentSupport";
import { percent } from "@/lib/utils";
import { useAuth } from "@/features/auth/context";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setError(null);
    try {
      const data = await studentApi.dashboard();
      setDashboard(data);
      if (data?.courses?.length && !selectedCourseId) {
        setSelectedCourseId(data.courses[0].course.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingSkeleton label="Loading your learning overview…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  const courses = dashboard?.courses || [];
  const currentCourse =
    courses.find((c) => c.course.id === selectedCourseId) || courses[0];
  const highlights = currentCourse ? achievements(currentCourse) : [];
  const visiblePlans = (dashboard?.visible_interventions || []).filter(
    (p) => !selectedCourseId || p.course_offering_id === selectedCourseId,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`One week at a time, ${user?.first_name || "learner"}.`}
        description="Your recent progress, shared goals, and a little room to grow."
      />

      {courses.length ? (
        <>
          {/* Course Selector Strip */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <span className="text-xs font-bold text-slate-700 ">
                Your class
              </span>
              <select
                aria-label="Choose your class"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 cursor-pointer shadow-2xs"
              >
                {courses.map((c) => (
                  <option key={c.course.id} value={c.course.id}>
                    {c.course.subject_name} · {c.course.classroom_name}
                  </option>
                ))}
              </select>
            </div>
            <Link
              to="/student/progress"
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
            >
              <span>View progress</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {currentCourse && (
            <>
              {/* Four Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                  title="Attendance Rate"
                  value={percent(currentCourse.attendance?.current)}
                  detail="Recent recorded week"
                  icon={
                    <CalendarCheck size={18} className="text-emerald-600" />
                  }
                />
                <MetricCard
                  title="Average Score"
                  value={percent(currentCourse.academic?.current)}
                  detail="Recent assessments"
                  icon={<BookOpen size={18} className="text-blue-600" />}
                />
                <MetricCard
                  title="Assignments"
                  value={percent(currentCourse.assignments?.completion_percent)}
                  detail="Completion rate"
                  icon={<CheckCheck size={18} className="text-purple-600" />}
                />
                <MetricCard
                  title="On-time Streak"
                  value={
                    currentCourse.assignments?.on_time_streak_weeks != null
                      ? `${currentCourse.assignments.on_time_streak_weeks} wks`
                      : "—"
                  }
                  detail="Consecutive on-time weeks"
                  icon={<Flame size={18} className="text-amber-500" />}
                />
              </div>

              {/* Progress Chart */}
              <ProgressChart weeks={currentCourse.weeks} metric="score" />

              {/* Achievement Highlights */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-amber-500" />
                  <h3 className="text-xs font-bold  text-slate-800">
                    Recent Learning Achievements
                  </h3>
                </div>

                {highlights.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {highlights.map((h, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-lg"
                      >
                        <h4 className="text-xs font-bold text-slate-900">
                          {h.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {h.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Keep up the great work! Achievements appear as weekly
                    observations are filed.
                  </p>
                )}
              </div>

              {/* Shared Support Plans */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold  text-slate-700 flex items-center gap-1.5">
                    <Target size={14} className="text-emerald-600" />
                    <span>Shared Goals & Learning Plans</span>
                  </h3>
                  <Link
                    to="/student/support"
                    className="text-xs text-emerald-800 hover:text-emerald-950 font-semibold"
                  >
                    View All Plans →
                  </Link>
                </div>

                {visiblePlans.length ? (
                  visiblePlans.map((plan) => (
                    <StudentSupport
                      key={plan.id}
                      plan={plan}
                      course={currentCourse}
                    />
                  ))
                ) : (
                  <div className="p-5 bg-white border border-slate-200/90 rounded-xl text-center text-xs text-slate-400">
                    No shared support plans active right now. Connect with your
                    teacher if you want to set new learning goals!
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <EmptyState
          title="No enrolled courses"
          description="Your school has not yet enrolled your student account in any active courses."
        />
      )}
    </div>
  );
}
