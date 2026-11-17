import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTeacherClassStudents } from "@/features/classes/hooks";
import {
  weeklyColumns,
  rawFields,
  weeklyFormSchema,
  weeklyPayload,
  type RawField,
  type WeeklyRecord,
  type WeeklyForm,
} from "@/features/weekly-records/schema";
import { parseCsv } from "@/features/weekly-records/csv";
import { api, onSessionExpired } from "@/lib/api/client";
import { allPages, mapLimited } from "@/lib/api/pagination";
import { useAuth } from "@/features/auth/context";
import { monday, today } from "@/features/progress/metrics";
import { PageHeader } from "@/components/common/domain";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import type { Student } from "@/types/api";
const drafts = new Map<string, WeeklyForm>();
onSessionExpired(() => drafts.clear());
export default function WeeklyEntry() {
  const { courseId = "" } = useParams();
  const [week, setWeek] = useState(monday(today()));
  const roster = useTeacherClassStudents(courseId);
  const validWeek = /^\d{4}-\d{2}-\d{2}$/.test(week) && week === monday(week);
  const existing = useQuery({
    queryKey: ["teacher", "class", courseId, "weekly", week],
    enabled: Boolean(roster.data && validWeek),
    queryFn: ({ signal }) =>
      mapLimited(
        roster.data ?? [],
        (s) =>
          allPages<WeeklyRecord>(
            `/teacher/students/${s.id}/weekly-records?course_offering_id=${courseId}&date_from=${week}&date_to=${week}`,
            signal,
          ),
        signal,
      ),
  });
  return (
    <>
      <Link className="back-link" to={`/teacher/classes/${courseId}`}>
        ← Back to class
      </Link>
      <PageHeader
        title="A week of learning"
        description="Enter the school information you already know. Blank means unknown; zero means measured zero."
      />
      <div className="panel padded">
        <label htmlFor="week-start">Week starting (Monday)</label>
        <input
          id="week-start"
          type="date"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
        />
        <p className="data-note">
          Save a draft before changing weeks. Drafts last until you reload or
          sign out.
        </p>
      </div>
      {!validWeek ? (
        <p role="alert" className="form-error">
          Choose a Monday.
        </p>
      ) : roster.isPending || existing.isPending ? (
        <LoadingSkeleton label="Loading weekly records" />
      ) : roster.error || existing.error ? (
        <ErrorState
          error={(roster.error ?? existing.error)!}
          retry={() => {
            void roster.refetch();
            void existing.refetch();
          }}
        />
      ) : !roster.data.length ? (
        <EmptyState
          title="No students enrolled"
          description="Your administrator can enroll students before you enter weekly records."
        />
      ) : (
        <WeeklyGrid
          key={`${courseId}-${week}`}
          courseId={courseId}
          week={week}
          students={roster.data}
          existing={existing.data.flat()}
        />
      )}
    </>
  );
}
function WeeklyGrid({
  courseId,
  week,
  students,
  existing,
}: {
  courseId: string;
  week: string;
  students: Student[];
  existing: WeeklyRecord[];
}) {
  const { user } = useAuth();
  const key = `${user?.school_id}:${user?.id}:${courseId}:${week}`;
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [csvError, setCsvError] = useState("");
  const form = useForm<WeeklyForm>({
    resolver: zodResolver(weeklyFormSchema),
    defaultValues: drafts.get(key) ?? {
      records: students.map((student) => {
        const record = existing.find((r) => r.student_id === student.id);
        return {
          student_id: student.id,
          selected: false,
          values: Object.fromEntries(
            rawFields.map((field) => [
              field,
              record?.[field]?.toString() ?? "",
            ]),
          ),
        };
      }),
    },
  });
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form.formState.isDirty]);
  const mutation = useMutation({
    mutationFn: (data: WeeklyForm) =>
      api<WeeklyRecord[]>("/teacher/weekly-records/batch", {
        method: "POST",
        body: JSON.stringify(weeklyPayload(data, courseId, week)),
      }),
    onSuccess: async () => {
      drafts.delete(key);
      form.reset({
        ...form.getValues(),
        records: form
          .getValues()
          .records.map((r) => ({ ...r, selected: false })),
      });
      setNotice("Selected weekly records saved. Other weeks are unchanged.");
      await client.invalidateQueries({ queryKey: ["teacher"] });
    },
  });
  async function importCsv(file: File) {
    setCsvError("");
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Use a CSV smaller than 1 MiB.");
      const [headers, ...rows] = parseCsv(await file.text());
      if (
        !headers.includes("roll_number") ||
        headers.some(
          (h) => h !== "roll_number" && !rawFields.includes(h as RawField),
        )
      )
        throw new Error(
          "Use roll_number and raw school fields only. The selected course and week apply to every row.",
        );
      const data = structuredClone(form.getValues());
      const seen = new Set<string>();
      for (const cells of rows) {
        const roll = cells[headers.indexOf("roll_number")];
        const index = students.findIndex((s) => s.roll_number === roll);
        if (index < 0 || seen.has(roll))
          throw new Error(
            "Every roll number must be unique and enrolled in this class.",
          );
        seen.add(roll);
        headers.forEach((h, i) => {
          if (h !== "roll_number") data.records[index].values[h] = cells[i];
        });
        data.records[index].selected = true;
      }
      const checked = weeklyFormSchema.safeParse(data);
      if (!checked.success)
        throw new Error(checked.error.issues.map((e) => e.message).join(" "));
      form.reset(data);
      setNotice(
        `${rows.length} CSV rows loaded for review. Submit the week to save them.`,
      );
    } catch (error) {
      setCsvError(
        error instanceof Error ? error.message : "CSV could not be read.",
      );
    }
  }
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
    >
      <div className="panel padded">
        <div className="section-heading compact">
          <h2>
            {students.length} students · {week}
          </h2>
          <label className="upload-label">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Import weekly CSV"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importCsv(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="data-note">
          Select up to 100 rows to submit atomically. Existing values for this
          week are loaded first, including fields outside this table. CSV header
          example:
          roll_number,classes_held,classes_attended,assessment_avg_score.
          Imported rows are reviewed before submission.
        </p>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Weekly entry table"
        >
          <table className="entry-table">
            <caption className="sr-only">Raw weekly records</caption>
            <thead>
              <tr>
                <th>Save</th>
                <th>Student</th>
                {weeklyColumns.map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student.id}>
                  <td>
                    <input
                      aria-label={`Select ${student.user.first_name} ${student.user.last_name}`}
                      type="checkbox"
                      {...form.register(`records.${index}.selected`)}
                    />
                  </td>
                  <th scope="row">
                    {student.user.first_name} {student.user.last_name}
                    <small>{student.roll_number}</small>
                  </th>
                  {weeklyColumns.map(([field, label]) => {
                    const error =
                      form.formState.errors.records?.[index]?.values?.[field];
                    return (
                      <td key={field}>
                        <input
                          aria-label={`${student.roll_number} ${label}`}
                          type="number"
                          step="any"
                          {...form.register(`records.${index}.values.${field}`)}
                          aria-invalid={Boolean(error)}
                        />
                        {error && (
                          <p className="field-error">{error.message}</p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              drafts.set(key, structuredClone(form.getValues()));
              setNotice(
                "Draft saved for this session. Reloading or signing out clears it.",
              );
            }}
          >
            Save draft
          </Button>
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Submit week"}
          </Button>
        </div>
        {(form.formState.errors.records?.message ||
          form.formState.errors.records?.root?.message) && (
          <p role="alert" className="form-error">
            {form.formState.errors.records?.message ||
              form.formState.errors.records?.root?.message}
          </p>
        )}
        {mutation.error && (
          <p role="alert" className="form-error">
            {mutation.error.message}
          </p>
        )}
        {csvError && (
          <p role="alert" className="form-error">
            {csvError}
          </p>
        )}
        {notice && (
          <p role="status" className="success-message">
            {notice}
          </p>
        )}
      </div>
    </form>
  );
}
