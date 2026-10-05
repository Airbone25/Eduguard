import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  adminCourseLabel,
  useCatalog,
  type ImportReport,
} from "@/features/admin/api";
import { parseCsv } from "@/features/weekly-records/csv";
import { PageHeader } from "@/components/common/domain";
import { LoadingSkeleton, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
export default function Imports() {
  const catalog = useCatalog();
  const qc = useQueryClient();
  const jobs = useQuery({
    queryKey: ["admin", "imports"],
    queryFn: ({ signal }) => adminApi.imports(signal),
  });
  const [kind, setKind] = useState("students");
  const [context, setContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState("");
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (dry: boolean) => {
      if (!file || !context)
        throw Error("Choose a file and the required context.");
      return adminApi.importFile(kind, file, context, dry);
    },
    onSuccess: async (result) => {
      setReport(result);
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const reset = () => {
    setReport(null);
    setError("");
    mutation.reset();
  };
  if (catalog.isPending) return <LoadingSkeleton />;
  if (catalog.error)
    return (
      <ErrorState error={catalog.error} retry={() => void catalog.refetch()} />
    );
  const validated = report?.status === "validated";
  const columns =
    preview[0]
      ?.map((name, index) => ({ name, index }))
      .filter((c) => c.name.toLowerCase() !== "password") ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Bring your information together."
        description="Validate a CSV, review every issue, then confirm the import."
      />
      <section className="panel padded stack">
        <fieldset disabled={mutation.isPending}>
          <legend>Import source</legend>
          <div className="form-grid">
            <label>
              Import type
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setContext("");
                  setFile(null);
                  setPreview([]);
                  reset();
                }}
              >
                <option value="students">Students</option>
                <option value="weekly-records">Weekly records</option>
              </select>
            </label>
            {kind === "students" ? (
              <label>
                Academic year
                <input
                  value={context}
                  maxLength={30}
                  onChange={(e) => {
                    setContext(e.target.value);
                    reset();
                  }}
                  placeholder="2026"
                />
              </label>
            ) : (
              <label>
                Course
                <select
                  value={context}
                  onChange={(e) => {
                    setContext(e.target.value);
                    reset();
                  }}
                >
                  <option value="">Choose course</option>
                  {catalog.data.courses
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {adminCourseLabel(c.id, catalog.data)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              CSV file (up to 100 rows, 1 MiB)
              <input
                key={kind}
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  reset();
                  setFile(null);
                  setPreview([]);
                  const selected = e.target.files?.[0];
                  if (!selected) return;
                  try {
                    if (selected.size > 1024 * 1024)
                      throw Error("Choose a CSV smaller than 1 MiB.");
                    const rows = parseCsv(await selected.text());
                    if (rows.length < 2)
                      throw Error(
                        "The CSV needs a header and at least one record.",
                      );
                    setFile(selected);
                    setPreview(rows);
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not read this CSV.",
                    );
                  }
                }}
              />
            </label>
          </div>
        </fieldset>
        <p className="data-note">
          {kind === "students"
            ? "Required columns: email, first_name, last_name, roll_number, grade, class_name. Optional: password. Classes must already exist in the selected academic year."
            : "Required columns: roll_number, subject_code, week_start. Include raw school measurements only. Existing rows for the same student, course, and week are replaced; omitted measurements become missing. Other weeks are retained."}
        </p>
        {error && <p role="alert">{error}</p>}
        {mutation.error && <p role="alert">{mutation.error.message}</p>}
        {preview.length > 0 && (
          <>
            <h2>Preview · {preview.length - 1} rows</h2>
            <p>First five rows shown. Password columns are hidden.</p>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">CSV preview</caption>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c.index}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1, 6).map((row, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c.index}>{row[c.index]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="actions">
          <Button
            variant="outline"
            disabled={!file || !context || mutation.isPending}
            onClick={() => mutation.mutate(true)}
          >
            {mutation.isPending ? "Working…" : "Validate CSV"}
          </Button>
          {validated && (
            <Button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(false)}
            >
              Confirm import of {report.rows_total} rows
            </Button>
          )}
        </div>
        {report && (
          <ImportResult
            report={report}
            clear={() => {
              setReport({ ...report, initial_credentials: [] });
              mutation.reset();
            }}
          />
        )}
      </section>
      <section className="panel padded">
        <h2>Import history</h2>
        {jobs.isPending ? (
          <LoadingSkeleton />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} retry={() => void jobs.refetch()} />
        ) : jobs.data.length ? (
          <ul className="activity-list">
            {jobs.data.slice(0, 30).map((job) => (
              <li key={job.id}>
                <details>
                  <summary>
                    {job.filename} · {job.status.replaceAll("_", " ")} ·{" "}
                    {job.rows_total} rows
                  </summary>
                  <ImportResult report={job} />
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p>No import jobs yet.</p>
        )}
      </section>
    </>
  );
}
function ImportResult({
  report,
  clear,
}: {
  report: ImportReport;
  clear?: () => void;
}) {
  return (
    <div className="stack">
      <p role="status">
        <strong>{report.status.replaceAll("_", " ")}</strong> ·{" "}
        {report.rows_succeeded} imported · {report.rows_failed} failed
      </p>
      {report.errors.length > 0 && (
        <div className="table-scroll">
          <table>
            <caption>
              Validation errors — fix these in the source file and upload again
            </caption>
            <thead>
              <tr>
                <th>CSV row</th>
                <th>Column</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {report.errors.map((e, i) => (
                <tr key={i}>
                  <td>{e.row_number}</td>
                  <td>{e.field}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!report.initial_credentials?.length && (
        <section className="panel padded">
          <h3>Initial sign-in details</h3>
          <p>
            Copy these credentials now. They are available only for this import
            response.
          </p>
          <ul>
            {report.initial_credentials.map((c) => (
              <li key={c.email}>
                {c.email} — <code>{c.initial_password}</code>
              </li>
            ))}
          </ul>
          <Button onClick={clear}>Dismiss credentials</Button>
        </section>
      )}
    </div>
  );
}
