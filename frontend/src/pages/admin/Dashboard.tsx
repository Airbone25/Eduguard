import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, ClipboardList } from "lucide-react";
import { PageHeader, MetricCard } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { adminApi, useCatalog } from "@/features/admin/api";
import { Button } from "@/components/ui/button";
export default function AdminDashboard() {
  const catalog = useCatalog();
  const jobs = useQuery({
    queryKey: ["admin", "imports"],
    queryFn: ({ signal }) => adminApi.imports(signal),
  });
  if (catalog.isPending || jobs.isPending) return <LoadingSkeleton />;
  const error = catalog.error || jobs.error;
  if (error)
    return (
      <ErrorState
        error={error}
        retry={() => {
          void catalog.refetch();
          void jobs.refetch();
        }}
      />
    );
  if (!catalog.data) return null;
  const d = catalog.data;
  return (
    <>
      <PageHeader
        eyebrow="School administration"
        title="A school ready to grow."
        description="Manage your people, learning spaces, and weekly information."
      />
      <div className="metric-grid">
        {[
          ["Teachers", d.teachers.length, Users],
          ["Students", d.students.length, Users],
          ["Classes", d.classes.length, BookOpen],
          [
            "Active Courses",
            d.courses.filter((c) => c.is_active).length,
            BookOpen,
          ],
          ["Recent Imports", jobs.data?.length ?? 0, ClipboardList],
        ].map(([label, count, Icon]) => {
          const Glyph = Icon as typeof Users;
          return (
            <MetricCard
              key={String(label)}
              title={String(label)}
              value={Number(count)}
              detail={
                label === "Recent Imports"
                  ? "Recorded import jobs"
                  : "In your school"
              }
              icon={<Glyph size={19} />}
            />
          );
        })}
      </div>
      <section className="panel padded">
        <h2>School essentials</h2>
        <div className="actions">
          {[
            "teachers",
            "students",
            "classes",
            "subjects",
            "courses",
            "imports",
            "settings",
          ].map((path) => (
            <Button key={path} variant="outline" asChild>
              <Link to={`/admin/${path}`}>
                {path[0].toUpperCase() + path.slice(1)}
              </Link>
            </Button>
          ))}
        </div>
      </section>
      <section className="panel padded">
        <h2>Recent imports</h2>
        {jobs.data?.length ? (
          <ul className="activity-list">
            {jobs.data.slice(0, 5).map((j) => (
              <li key={j.id}>
                <Link to="/admin/imports">{j.filename}</Link>
                <span>
                  {j.status.replaceAll("_", " ")} · {j.rows_total} rows
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No imports yet"
            description="Add a few people manually, or upload a CSV to get started."
          />
        )}
      </section>
    </>
  );
}
