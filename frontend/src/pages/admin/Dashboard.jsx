import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  BookOpen,
  FileSpreadsheet,
  Settings,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { PageHeader, MetricCard } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";

export default function AdminDashboard() {
  const [catalog, setCatalog] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setError(null);
    try {
      const [cat, imp] = await Promise.all([
        adminApi.catalog(),
        adminApi.imports(),
      ]);
      setCatalog(cat);
      setJobs(imp || []);
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
    return <LoadingSkeleton label="Loading school directory metrics…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  const d = catalog || {
    teachers: [],
    students: [],
    classes: [],
    subjects: [],
    courses: [],
  };

  const activeCourses = d.courses.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your school, connected."
        description="Manage the people, classes, and records that keep student support moving."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Teachers"
          value={d.teachers.length}
          detail="Active educators"
          icon={<Users size={18} />}
        />
        <MetricCard
          title="Students"
          value={d.students.length}
          detail="Enrolled students"
          icon={<Users size={18} />}
        />
        <MetricCard
          title="Class Sections"
          value={d.classes.length}
          detail="Active classes"
          icon={<BookOpen size={18} />}
        />
        <MetricCard
          title="Active Courses"
          value={activeCourses}
          detail="Subject offerings"
          icon={<BookOpen size={18} />}
        />
        <MetricCard
          title="Recent Imports"
          value={jobs.length}
          detail="Processed jobs"
          icon={<FileSpreadsheet size={18} />}
        />
      </div>

      {/* Quick Navigation Sections */}
      <section className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold  text-slate-700 mb-3">
          School essentials
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            "teachers",
            "students",
            "classes",
            "subjects",
            "courses",
            "imports",
            "settings",
          ].map((path) => (
            <Link
              key={path}
              to={`/admin/${path}`}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors capitalize flex items-center gap-1.5"
            >
              <span>{path}</span>
              <ArrowUpRight size={12} className="text-slate-400" />
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Imports */}
      <section className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold  text-slate-700">
            Recent Import Jobs
          </h3>
          <Link
            to="/admin/imports"
            className="text-xs font-semibold text-amber-800 hover:text-amber-950"
          >
            Manage Imports →
          </Link>
        </div>

        {jobs.length ? (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="p-3 flex items-center justify-between text-xs hover:bg-slate-50"
              >
                <div>
                  <span className="font-semibold text-slate-900 block font-mono">
                    {job.filename}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {job.import_type} · {job.rows_total} rows (
                    {job.rows_succeeded} succeeded)
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {job.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No CSV imports logged"
            description="Use the CSV Import workspace to upload batch student rosters or weekly records."
          />
        )}
      </section>
    </div>
  );
}
