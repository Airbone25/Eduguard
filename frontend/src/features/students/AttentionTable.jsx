import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { SupportBadge, TrendIndicator } from "@/components/common/domain";
import { percent } from "@/lib/utils";
export function AttentionTable({ courseId, students = [] }) {
  const [search, setSearch] = useState("");
  const [supportFilter, setSupportFilter] = useState("all");
  const [trendFilter, setTrendFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          (!search.trim() ||
            `${s.name} ${s.roll_number}`
              .toLowerCase()
              .includes(search.trim().toLowerCase())) &&
          (supportFilter === "all" || s.support_level === supportFilter) &&
          (trendFilter === "all" || s.trajectory === trendFilter) &&
          (planFilter === "all" ||
            (planFilter === "active"
              ? s.active_intervention
              : !s.active_intervention)),
      ),
    [students, search, supportFilter, trendFilter, planFilter],
  );
  const clear = () => {
    setSearch("");
    setSupportFilter("all");
    setTrendFilter("all");
    setPlanFilter("all");
  };
  return (
    <div className="roster-panel">
      <div className="roster-toolbar">
        <div className="roster-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a student…"
            aria-label="Search student roster"
          />
        </div>
        <div className="roster-filters">
          <select
            value={supportFilter}
            onChange={(e) => setSupportFilter(e.target.value)}
            aria-label="Filter by support level"
          >
            <option value="all">All support levels</option>
            <option value="priority_support">Priority support</option>
            <option value="watch">On watch</option>
            <option value="doing_well">Doing well</option>
            <option value="not_assessed">Not assessed</option>
          </select>
          <select
            value={trendFilter}
            onChange={(e) => setTrendFilter(e.target.value)}
            aria-label="Filter by trend"
          >
            <option value="all">All trends</option>
            <option value="declining">Declining</option>
            <option value="improving">Improving</option>
            <option value="stable">Stable</option>
            <option value="insufficient_history">Not enough history</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label="Filter by support plan"
          >
            <option value="all">All plans</option>
            <option value="active">Active plan</option>
            <option value="none">No active plan</option>
          </select>
        </div>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Student records; scroll horizontally for all columns"
      >
        <table className="roster-table">
          <caption className="sr-only">
            Class observations and student support
          </caption>
          <thead>
            <tr>
              <th scope="col">Student & latest observation</th>
              <th scope="col">Support level</th>
              <th scope="col">Trend</th>
              <th scope="col" className="numeric">
                Score
              </th>
              <th scope="col" className="numeric">
                Attendance
              </th>
              <th scope="col">Support plan</th>
              <th scope="col">
                <span className="sr-only">Open profile</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const url = `/teacher/students/${encodeURIComponent(s.student_id)}?course=${encodeURIComponent(courseId)}`;
              return (
                <tr key={s.student_id}>
                  <td>
                    <Link to={url} className="roster-name">
                      {s.name}
                    </Link>
                    <span className="roster-roll">{s.roll_number}</span>
                    <p className="roster-observation">
                      {s.top_signal || "No observation summary yet"}
                    </p>
                  </td>
                  <td>
                    <SupportBadge level={s.support_level} />
                  </td>
                  <td>
                    <TrendIndicator trend={s.trajectory} />
                  </td>
                  <td className="numeric">{percent(s.latest_score)}</td>
                  <td className="numeric">{percent(s.attendance)}</td>
                  <td>
                    {s.active_intervention ? (
                      <span className="plan-active">
                        <CheckCircle2 size={13} />
                        Active
                      </span>
                    ) : (
                      <span className="text-slate-500">No active plan</span>
                    )}
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      to={url}
                      aria-label={`Review ${s.name}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="roster-empty" role="status">
          <strong>
            {students.length
              ? "No students match these filters"
              : "No student observations yet"}
          </strong>
          <p>
            {students.length
              ? "Try another name or reset your filters."
              : "Record a week to start building the class picture."}
          </p>
          {students.length > 0 && (
            <button className="button button-secondary" onClick={clear}>
              Reset filters
            </button>
          )}
        </div>
      )}
      <div className="roster-footer" aria-live="polite">
        Showing {filtered.length} of {students.length} students
        <span>Latest recorded observations</span>
      </div>
    </div>
  );
}
