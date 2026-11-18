import React, { useState, useEffect } from "react";
import { Plus, Search, Users, CheckCircle2, XCircle } from "lucide-react";
import { adminApi, adminCourseLabel } from "@/lib/api/admin";
import { PageHeader } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { EntityForm } from "@/features/admin/EntityForm";
import { CourseMembers } from "@/features/admin/CourseMembers";

export default function Management({ kind }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [editEntity, setEditEntity] = useState(null);
  const [managingMembersCourseId, setManagingMembersCourseId] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    setError(null);
    try {
      const res = await adminApi.catalog();
      setCatalog(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [kind]);

  if (loading) {
    return <LoadingSkeleton label={`Loading ${kind}…`} />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  const data = catalog || {
    teachers: [],
    students: [],
    classes: [],
    subjects: [],
    courses: [],
  };

  const rows =
    kind === "teachers" || kind === "students"
      ? data[kind].map((p) => ({
          id: p.id,
          userId: p.user_id,
          name: `${p.user?.first_name || ""} ${p.user?.last_name || ""}`,
          first_name: p.user?.first_name,
          last_name: p.user?.last_name,
          email: p.user?.email,
          roll_number: p.roll_number,
          grade_label: p.grade_label,
          employee_code: p.employee_code,
          is_active: p.user?.is_active ?? true,
        }))
      : kind === "courses"
        ? data.courses.map((c) => ({
            id: c.id,
            name: adminCourseLabel(c.id, data),
            is_active: c.is_active ?? true,
          }))
        : data[kind] || [];

  const filtered = rows.filter((r) => {
    const matchSearch =
      !search.trim() ||
      `${r.name || ""} ${r.email || ""} ${r.roll_number || ""} ${r.code || ""}`
        .toLowerCase()
        .includes(search.toLowerCase().trim());
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? r.is_active : !r.is_active);
    return matchSearch && matchStatus;
  });

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleToggleActive = async (row) => {
    try {
      const path = row.userId
        ? `users/${row.userId}`
        : kind === "courses"
          ? `course-offerings/${row.id}`
          : `${kind}/${row.id}`;
      await adminApi.write(path, { is_active: !row.is_active }, "PATCH");
      setNotice(`Updated status for ${row.name || "record"}.`);
      loadData();
    } catch (err) {
      alert(err?.message || "Failed to update status.");
    }
  };

  const getEntityLabel = () => {
    if (kind === "classes") return "Class";
    return kind.slice(0, -1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${kind[0].toUpperCase() + kind.slice(1)}`}
        description={`Configure and maintain ${kind} records with integrity.`}
      >
        <button
          type="button"
          onClick={() => setEditEntity(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={14} />
          <span>Add {getEntityLabel()}</span>
        </button>
      </PageHeader>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
          {notice}
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={`Search ${kind}…`}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-2xs"
          />
        </div>

        {kind !== "subjects" && (
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 shadow-2xs cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-semibold  text-[11px]">
                <th className="py-3 px-4">Entity Name / Details</th>
                <th className="py-3 px-4">Identifier / Metadata</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginated.length ? (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block font-sans">
                        {r.name}
                      </span>
                      {r.email && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {r.email}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {r.roll_number
                        ? `Roll: ${r.roll_number} · ${r.grade_label}`
                        : r.employee_code
                          ? `Code: ${r.employee_code}`
                          : r.code
                            ? `Subject Code: ${r.code}`
                            : r.academic_year
                              ? `Year: ${r.academic_year}`
                              : r.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4">
                      {r.is_active !== undefined ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${
                            r.is_active
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {kind !== "courses" && (
                        <button
                          type="button"
                          onClick={() => setEditEntity(r)}
                          className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      {kind === "courses" && (
                        <button
                          type="button"
                          onClick={() => setManagingMembersCourseId(r.id)}
                          className="px-2.5 py-1 text-amber-900 hover:bg-amber-50 border border-amber-300 rounded font-semibold cursor-pointer"
                        >
                          Manage People
                        </button>
                      )}
                      {r.is_active !== undefined && (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(r)}
                          className={`px-2 py-1 text-[11px] font-medium rounded ${
                            r.is_active
                              ? "text-slate-500 hover:text-red-700"
                              : "text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {r.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-slate-400 text-xs"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages} · {filtered.length} total records
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>

      {editEntity && (
        <EntityForm
          kind={kind}
          edit={editEntity === true ? undefined : editEntity}
          data={data}
          onClose={() => setEditEntity(null)}
          onSaved={() => {
            setEditEntity(null);
            loadData();
          }}
        />
      )}

      {managingMembersCourseId && (
        <CourseMembers
          courseId={managingMembersCourseId}
          data={data}
          onClose={() => setManagingMembersCourseId("")}
        />
      )}
    </div>
  );
}
