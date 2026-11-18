import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, GraduationCap, Plus } from "lucide-react";
import { teacherApi } from "@/lib/api/teacher";
import { interventionApi } from "@/lib/api/interventions";
import { PageHeader } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { InterventionCard } from "@/features/interventions/InterventionCard";
import { courseLabel } from "@/lib/utils";

export default function Interventions() {
  const [classes, setClasses] = useState([]);
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setError(null);
    try {
      const [cls, plns] = await Promise.all([
        teacherApi.classes(),
        interventionApi.all(courseFilter, statusFilter),
      ]);
      setClasses(cls || []);
      setPlans(plns || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [courseFilter, statusFilter]);

  if (loading) {
    return <LoadingSkeleton label="Loading support plans directory…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support plans"
        description="Keep track of the next conversation, the shared goal, and the follow-through."
      />

      {/* Filter toolbar */}
      <div className="p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="course-filter"
            className="block text-[11px] font-bold  text-slate-400 font-mono mb-1"
          >
            Course Offering
          </label>
          <select
            id="course-filter"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
          >
            <option value="">All Assigned Courses</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {courseLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="w-48">
          <label
            htmlFor="status-filter"
            className="block text-[11px] font-bold  text-slate-400 font-mono mb-1"
          >
            Plan Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Plans</option>
            <option value="planned">Planned (Draft)</option>
            <option value="completed">Completed Plans</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {plans.length ? (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="relative">
              <div className="flex justify-end mb-1">
                <Link
                  to={`/teacher/students/${plan.student_id}?course=${plan.course_offering_id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950"
                >
                  <span>Open student profile</span>
                  <ArrowUpRight size={12} />
                </Link>
              </div>
              <InterventionCard plan={plan} onRefresh={loadData} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No support plans match this filter"
          description="Adjust your filters or initiate a new support plan directly from a student profile."
        />
      )}
    </div>
  );
}
