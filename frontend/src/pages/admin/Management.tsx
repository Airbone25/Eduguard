import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { adminApi, adminCourseLabel, useCatalog } from "@/features/admin/api";
import {
  EntityForm,
  type EntityKind,
  type EditEntity,
} from "@/features/admin/EntityForm";
import { CourseMembers } from "@/features/admin/CourseMembers";
export default function Management({ kind }: { kind: EntityKind }) {
  const query = useCatalog();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<EditEntity | true | null>(null);
  const [toggle, setToggle] = useState<EditEntity | null>(null);
  const [members, setMembers] = useState("");
  const [notice, setNotice] = useState("");
  const update = useMutation({
    mutationFn: (row: EditEntity) =>
      adminApi.write(
        `${row.userId ? "users" : kind === "courses" ? "course-offerings" : kind}/${row.userId ?? row.id}`,
        { is_active: !row.is_active },
        "PATCH",
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      setToggle(null);
      setNotice("Account or course status updated.");
    },
  });
  if (query.isPending) return <LoadingSkeleton />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const data = query.data;
  const rows: EditEntity[] =
    kind === "teachers" || kind === "students"
      ? data[kind].map((p) => ({
          id: p.id,
          userId: p.user_id,
          name: `${p.user.first_name} ${p.user.last_name}`,
          first_name: p.user.first_name,
          last_name: p.user.last_name,
          email: p.user.email,
          is_active: p.user.is_active,
        }))
      : kind === "courses"
        ? data.courses.map((c) => ({
            id: c.id,
            name: adminCourseLabel(c.id, data),
            is_active: c.is_active,
          }))
        : data[kind];
  const filtered = rows.filter(
    (r) =>
      `${r.name} ${r.email ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "all" || r.is_active === (status === "active")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages - 1);
  return (
    <>
      <PageHeader
        eyebrow="School management"
        title={kind[0].toUpperCase() + kind.slice(1)}
        description="Keep your school information current. Existing learning history is preserved."
      >
        <Button onClick={() => setEdit(true)}>
          Add {kind === "classes" ? "class" : kind.slice(0, -1)}
        </Button>
      </PageHeader>
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}
      <section className="panel">
        <div className="table-tools">
          <input
            aria-label={`Search ${kind}`}
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          {kind !== "subjects" && (
            <select
              aria-label="Filter status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          )}
        </div>
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">School {kind}</caption>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(current * 20, (current + 1) * 20).map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{r.name}</th>
                      <td>
                        {r.email ??
                          (kind === "subjects"
                            ? data.subjects.find((s) => s.id === r.id)?.code
                            : kind === "classes"
                              ? data.classes.find((c) => c.id === r.id)
                                  ?.academic_year
                              : "")}
                      </td>
                      <td>
                        {r.is_active === undefined
                          ? "—"
                          : r.is_active
                            ? "Active"
                            : "Inactive"}
                      </td>
                      <td>
                        <div className="actions">
                          {kind !== "courses" && (
                            <Button
                              variant="ghost"
                              onClick={() => setEdit(r)}
                              aria-label={`Edit ${r.name}`}
                            >
                              Edit
                            </Button>
                          )}
                          {r.is_active !== undefined && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                update.reset();
                                setToggle(r);
                              }}
                            >
                              {r.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                          {kind === "courses" && (
                            <Button
                              variant="outline"
                              onClick={() => setMembers(r.id)}
                            >
                              People
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-tools">
              <Button
                variant="outline"
                disabled={!current}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <span>
                Page {current + 1} of {pages} · {filtered.length} records
              </span>
              <Button
                variant="outline"
                disabled={current + 1 >= pages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            title="No matching records"
            description="Try another search or add a new school record."
          />
        )}
      </section>
      {edit && (
        <EntityForm
          key={edit === true ? "new" : edit.id}
          kind={kind}
          edit={edit === true ? undefined : edit}
          data={data}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            setNotice("Saved successfully.");
          }}
        />
      )}
      {toggle && (
        <Modal
          open
          onOpenChange={(o) => {
            if (!o && !update.isPending) setToggle(null);
          }}
          title={`${toggle.is_active ? "Deactivate" : "Activate"} ${toggle.name}?`}
          description="Access follows the active status. Historical records are retained."
        >
          {update.error && <p role="alert">{update.error.message}</p>}
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate(toggle)}
          >
            Confirm status change
          </Button>
        </Modal>
      )}
      {members && (
        <CourseMembers
          course={members}
          data={data}
          onClose={() => setMembers("")}
        />
      )}
    </>
  );
}
