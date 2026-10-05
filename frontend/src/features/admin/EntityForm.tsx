import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { adminApi, type Catalog } from "./api";
export type EntityKind =
  "teachers" | "students" | "classes" | "subjects" | "courses";
export interface EditEntity {
  id: string;
  userId?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_active?: boolean;
}
interface Field {
  key: string;
  label: string;
  type?: string;
  max?: number;
  options?: { value: string; label: string }[];
}
export function EntityForm({
  kind,
  edit,
  data,
  onClose,
  onSaved,
}: {
  kind: EntityKind;
  edit?: EditEntity;
  data: Catalog;
  onClose: () => void;
  onSaved: () => void;
}) {
  const people = kind === "students" || kind === "teachers";
  const fields: Field[] = people
    ? [
        { key: "first_name", label: "First name", max: 100 },
        { key: "last_name", label: "Last name", max: 100 },
        { key: "email", label: "Email", type: "email" },
        ...(!edit
          ? [
              {
                key: "password",
                label: "Initial password (12–128 characters)",
                type: "password",
              },
              ...(kind === "students"
                ? [
                    { key: "roll_number", label: "Roll number", max: 100 },
                    { key: "grade_label", label: "Grade", max: 50 },
                  ]
                : [{ key: "employee_code", label: "Employee code", max: 100 }]),
            ]
          : []),
      ]
    : kind === "classes"
      ? [
          { key: "name", label: "Class name", max: 100 },
          ...(!edit
            ? [
                { key: "grade_label", label: "Grade", max: 50 },
                { key: "academic_year", label: "Academic year", max: 30 },
              ]
            : []),
        ]
      : kind === "subjects"
        ? [
            { key: "name", label: "Subject name", max: 100 },
            ...(!edit ? [{ key: "code", label: "Subject code", max: 40 }] : []),
          ]
        : !edit
          ? [
              {
                key: "classroom_id",
                label: "Class",
                options: data.classes
                  .filter((c) => c.is_active)
                  .map((c) => ({
                    value: c.id,
                    label: `${c.name} · ${c.academic_year}`,
                  })),
              },
              {
                key: "subject_id",
                label: "Subject",
                options: data.subjects.map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              },
            ]
          : [];
  const shape: Record<string, z.ZodType<string, string>> = {};
  for (const f of fields)
    shape[f.key] =
      f.key === "email"
        ? z.email("Enter a valid email")
        : f.key === "password"
          ? z.string().min(12).max(128)
          : z
              .string()
              .trim()
              .min(1, "This field is required")
              .max(f.max ?? 200);
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(z.object(shape)),
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.key,
        String(edit?.[f.key as keyof EditEntity] ?? ""),
      ]),
    ),
  });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (values: Record<string, string>) => {
      const body: Record<string, unknown> = { ...values };
      if (kind === "courses" && !edit)
        body.academic_year = data.classes.find(
          (c) => c.id === values.classroom_id,
        )?.academic_year;
      return adminApi.write(
        edit
          ? `${people ? "users" : kind === "courses" ? "course-offerings" : kind}/${edit.userId ?? edit.id}`
          : kind === "courses"
            ? "course-offerings"
            : kind,
        body,
        edit ? "PATCH" : "POST",
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      onSaved();
    },
    gcTime: 0,
  });
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
      title={`${edit ? "Edit" : "Add"} ${kind === "classes" ? "class" : kind.slice(0, -1)}`}
      description="Changes apply only to your school."
    >
      <form
        noValidate
        className="stack"
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
      >
        {fields.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`entity-${f.key}`}>{f.label}</label>
            {f.options ? (
              <select
                id={`entity-${f.key}`}
                aria-describedby={`entity-error-${f.key}`}
                {...form.register(f.key)}
                aria-invalid={!!form.formState.errors[f.key]}
              >
                <option value="">Choose…</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`entity-${f.key}`}
                aria-describedby={`entity-error-${f.key}`}
                type={f.type ?? "text"}
                autoComplete={f.type === "password" ? "new-password" : "off"}
                {...form.register(f.key)}
                aria-invalid={!!form.formState.errors[f.key]}
              />
            )}
            <span className="field-error" id={`entity-error-${f.key}`}>
              {form.formState.errors[f.key]?.message}
            </span>
          </div>
        ))}
        {save.error && <p role="alert">{save.error.message}</p>}
        <Button disabled={save.isPending} type="submit">
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Modal>
  );
}
