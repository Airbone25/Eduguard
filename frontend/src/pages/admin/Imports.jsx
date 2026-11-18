import React, { useState, useEffect } from "react";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  KeyRound,
} from "lucide-react";
import { adminApi, adminCourseLabel } from "@/lib/api/admin";
import { parseCsv } from "@/features/weekly-records/csv";
import { PageHeader } from "@/components/common/domain";
import { LoadingSkeleton, ErrorState } from "@/components/common/states";

export default function Imports() {
  const [catalog, setCatalog] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [kind, setKind] = useState("students");
  const [context, setContext] = useState("2026");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [report, setReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState("");

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

  const handleFileChange = async (e) => {
    setParseError("");
    setReport(null);
    setPreview([]);
    const selected = e.target.files?.[0];
    if (!selected) return;

    try {
      if (selected.size > 1024 * 1024)
        throw new Error("File exceeds 1 MiB maximum size.");
      const text = await selected.text();
      const rows = parseCsv(text);
      if (rows.length < 2)
        throw new Error("CSV requires a header and at least one data row.");
      setFile(selected);
      setPreview(rows);
    } catch (err) {
      setParseError(err?.message || "Could not parse CSV.");
      setFile(null);
    }
  };

  const handleImport = async (dryRun) => {
    if (!file || !context) {
      setParseError(
        "Please select a file and provide the required academic context.",
      );
      return;
    }
    setSubmitting(true);
    setParseError("");
    try {
      const result = await adminApi.importFile(kind, file, context, dryRun);
      setReport(result);
      if (!dryRun) {
        loadData();
      }
    } catch (err) {
      setParseError(err?.message || "Import operation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton label="Loading import configurations…" />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadData} />;
  }

  const columns =
    preview[0]
      ?.map((name, index) => ({ name, index }))
      .filter((c) => c.name.toLowerCase() !== "password") || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="CSV Bulk Ingestion Workspace"
        description="Check and import student rosters or weekly observations from a CSV file."
      />

      <section className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
        <h3 className="text-xs font-bold  text-slate-700">
          Source CSV & Academic Scope
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label
              htmlFor="field-import-type"
              className="block font-semibold text-slate-700 mb-1"
            >
              Import Type
            </label>
            <select
              id="field-import-type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setContext(
                  e.target.value === "students"
                    ? "2026"
                    : catalog?.courses?.[0]?.id || "",
                );
                setFile(null);
                setPreview([]);
                setReport(null);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
            >
              <option value="students">Student Roster & Accounts</option>
              <option value="weekly-records">Historical Weekly Records</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {kind === "students" ? "Academic Year" : "Target Course Offering"}
            </label>
            {kind === "students" ? (
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono"
              />
            ) : (
              <select
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="">Choose course…</option>
                {catalog?.courses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {adminCourseLabel(c.id, catalog)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="field-csv-file-up-to-100-rows-lt-1-mib"
              className="block font-semibold text-slate-700 mb-1"
            >
              CSV File (up to 100 rows, &lt; 1 MiB)
            </label>
            <input
              id="field-csv-file-up-to-100-rows-lt-1-mib"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-500 leading-relaxed font-mono">
          {kind === "students"
            ? "Required header: email, first_name, last_name, roll_number, grade, class_name. Optional: password."
            : "Required header: roll_number, subject_code, week_start, classes_held, classes_attended, assessment_avg_score."}
        </div>

        {parseError && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs">
            {parseError}
          </div>
        )}

        {/* CSV Preview */}
        {preview.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800">
              CSV Preview (First 5 of {preview.length - 1} data rows)
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    {columns.map((c) => (
                      <th
                        key={c.index}
                        className="p-2 border-r border-slate-200 last:border-0"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.slice(1, 6).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {columns.map((c) => (
                        <td
                          key={c.index}
                          className="p-2 border-r border-slate-100 last:border-0"
                        >
                          {row[c.index] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                disabled={submitting || !file}
                onClick={() => handleImport(true)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold rounded-lg text-xs shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Validating…" : "Step 1: Dry-Run Validation"}
              </button>

              {report?.status === "validated" && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleImport(false)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  Step 2: Confirm Ingestion of {report.rows_total} Rows
                </button>
              )}
            </div>
          </div>
        )}

        {/* Validation Result / Execution Report */}
        {report && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 font-mono">
                Status: {report.status?.replace("_", " ").toUpperCase()}
              </span>
              <span className="text-slate-500 font-mono">
                Total: {report.rows_total} | Succeeded: {report.rows_succeeded}{" "}
                | Failed: {report.rows_failed}
              </span>
            </div>

            {report.errors?.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                <span className="text-xs font-bold text-red-800">
                  Validation Errors to Correct in CSV:
                </span>
                <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                  {report.errors.map((e, idx) => (
                    <li key={idx}>
                      Row {e.row_number} [{e.field}]: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.initial_credentials?.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <KeyRound size={15} />
                  <span>One-Time Generated Credentials</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Record these initial credentials now. They will not be
                  displayed again.
                </p>
                <div className="max-h-36 overflow-y-auto font-mono text-[11px] text-slate-800 divide-y divide-amber-200">
                  {report.initial_credentials.map((cred) => (
                    <div key={cred.email} className="py-1 flex justify-between">
                      <span>{cred.email}</span>
                      <strong className="text-amber-950">
                        {cred.initial_password}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* History */}
      <section className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold  text-slate-700 mb-3">
          Historical Ingestion Records
        </h3>

        {jobs.length ? (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-3 flex items-center justify-between text-xs hover:bg-slate-50"
              >
                <div>
                  <span className="font-semibold text-slate-900 block font-mono">
                    {job.filename}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {job.import_type} · {job.rows_succeeded} / {job.rows_total}{" "}
                    succeeded ·{" "}
                    {new Date(
                      job.created_at || Date.now(),
                    ).toLocaleDateString()}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-slate-100 text-slate-700">
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            No previous imports recorded.
          </p>
        )}
      </section>
    </div>
  );
}
