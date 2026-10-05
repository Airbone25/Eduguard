import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Minus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { SupportBadge, TrendIndicator } from "@/components/common/domain";
import { percent } from "@/lib/utils";
import type { DashboardStudent } from "@/types/api";
export function AttentionTable({
  students,
  courseId,
}: {
  students: DashboardStudent[];
  courseId: string;
}) {
  const columns = useMemo<ColumnDef<DashboardStudent>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Student",
        cell: ({ row: { original: s } }) => (
          <Link
            className="student-link"
            to={`/teacher/students/${s.student_id}?course=${encodeURIComponent(courseId)}`}
          >
            <span className="student-avatar">
              {s.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{s.name}</strong>
              <small>{s.roll_number}</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
        ),
      },
      {
        accessorKey: "support_level",
        header: "Support status",
        cell: ({ row }) => <SupportBadge level={row.original.support_level} />,
      },
      {
        accessorKey: "trajectory",
        header: "Trend",
        cell: ({ row }) => <TrendIndicator trend={row.original.trajectory} />,
      },
      {
        accessorKey: "attendance",
        header: "Attendance",
        cell: ({ row }) => (
          <span
            className="numeric"
            aria-label={
              row.original.attendance === null
                ? "Attendance not available"
                : undefined
            }
          >
            {percent(row.original.attendance)}
          </span>
        ),
      },
      {
        accessorKey: "latest_score",
        header: "Average score",
        cell: ({ row }) => (
          <span
            className="numeric"
            aria-label={
              row.original.latest_score === null
                ? "Score not available"
                : undefined
            }
          >
            {percent(row.original.latest_score)}
          </span>
        ),
      },
      {
        accessorKey: "top_signal",
        header: "Main signal",
        cell: ({ row }) => (
          <span className="signal-cell">
            {row.original.top_signal || "No signal available"}
          </span>
        ),
      },
      {
        accessorKey: "active_intervention",
        header: "Intervention",
        cell: ({ row }) =>
          row.original.active_intervention ? (
            <span className="plan-indicator">
              <Check size={14} />
              Open plan
            </span>
          ) : (
            <span className="muted plan-indicator">
              <Minus size={14} />
              No open plan
            </span>
          ),
      },
    ],
    [courseId],
  );
  return (
    <DataTable
      data={students}
      columns={columns}
      caption="Student support, attendance, scores, and intervention status"
    />
  );
}
