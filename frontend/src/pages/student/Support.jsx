import React, { useState, useEffect } from "react";
import { studentApi } from "@/lib/api/student";
import { achievements } from "@/features/progress/student";
import { PageHeader } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { StudentSupport } from "@/features/progress/StudentSupport";
import { Award, Target } from "lucide-react";

export default function Support({ goals = false }) {
  const [dashboard, setDashboard] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setError(null);
    try {
      const [dash, sup] = await Promise.all([
        studentApi.dashboard(),
        studentApi.support(),
      ]);
      setDashboard(dash);
      setPlans(sup || []);
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
    return <LoadingSkeleton label="Loading your support and goal plans…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  const courses = dashboard?.courses || [];
  const filteredPlans = goals
    ? plans.filter(
        (p) =>
          p.goal_definition?.attendance_target != null ||
          p.goal_definition?.assessment_avg_score_target != null,
      )
    : plans;

  return (
    <div className="space-y-6">
      <PageHeader
        title={goals ? "My goals" : "Your support team, in action."}
        description={
          goals
            ? "Follow along with the personalized attendance and score goals you established with your educators."
            : "Shared action plans designed to help you stay on track and thrive in every subject."
        }
      />

      <div className="space-y-4">
        {filteredPlans.length ? (
          filteredPlans.map((plan) => (
            <StudentSupport
              key={plan.id}
              plan={plan}
              course={courses.find(
                (c) => c.course.id === plan.course_offering_id,
              )}
            />
          ))
        ) : (
          <EmptyState
            title={goals ? "No shared goals yet" : "No active support plans"}
            description="Discuss with your teacher if there are specific attendance or homework goals you want to collaborate on."
          />
        )}
      </div>

      {goals && courses.length > 0 && (
        <section className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-500" />
            <h3 className="text-xs font-bold  text-slate-800">
              Subject Achievements
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {courses.flatMap((c) =>
              achievements(c).map((a, i) => (
                <div
                  key={`${c.course.id}-${i}`}
                  className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg text-xs"
                >
                  <span className="font-mono text-[11px] text-slate-400 block mb-0.5">
                    {c.course.subject_name}
                  </span>
                  <h4 className="font-bold text-slate-900">{a.title}</h4>
                  <p className="text-slate-600 mt-1">{a.detail}</p>
                </div>
              )),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
