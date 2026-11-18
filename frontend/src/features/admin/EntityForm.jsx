import React, { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { adminApi } from "@/lib/api/admin";

export function EntityForm({ kind, edit, data, onClose, onSaved }) {
  const isPerson = kind === "teachers" || kind === "students";

  const [formData, setFormData] = useState(() => {
    if (edit) {
      return {
        first_name: edit.first_name || "",
        last_name: edit.last_name || "",
        email: edit.email || "",
        name: edit.name || "",
        grade_label: edit.grade_label || "",
        academic_year: edit.academic_year || "",
        code: edit.code || "",
      };
    }
    return {
      first_name: "",
      last_name: "",
      email: "",
      password: "EduGuard-Demo-2026!",
      roll_number: "",
      employee_code: "",
      grade_label: "Grade 10",
      academic_year: "2026",
      name: "",
      code: "",
      classroom_id: data?.classes?.[0]?.id || "",
      subject_id: data?.subjects?.[0]?.id || "",
    };
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const path = edit
        ? `${isPerson ? "users" : kind === "courses" ? "course-offerings" : kind}/${edit.userId || edit.id}`
        : kind === "courses"
          ? "course-offerings"
          : kind;
      const method = edit ? "PATCH" : "POST";

      const payload = { ...formData };
      if (kind === "courses" && !edit) {
        payload.academic_year =
          data.classes.find((c) => c.id === formData.classroom_id)
            ?.academic_year || "2026";
      }

      await adminApi.write(path, payload, method);
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to save record.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    const single = kind === "classes" ? "Class" : kind.slice(0, -1);
    return edit ? `Edit ${single}` : `Add New ${single}`;
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !submitting && onClose()}
      title={getTitle()}
      description="Add or update this record for your school."
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-2.5 rounded bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {isPerson && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="field-first-name"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  First Name
                </label>
                <input
                  id="field-first-name"
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleChange("first_name", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="field-last-name"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Last Name
                </label>
                <input
                  id="field-last-name"
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleChange("last_name", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="field-institutional-email"
                className="block font-semibold text-slate-700 mb-1"
              >
                Institutional Email
              </label>
              <input
                id="field-institutional-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            {!edit && (
              <div>
                <label
                  htmlFor="field-temporary-initial-password"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Temporary Initial Password
                </label>
                <input
                  id="field-temporary-initial-password"
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>
            )}

            {!edit && kind === "students" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="field-roll-number"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Roll Number
                  </label>
                  <input
                    id="field-roll-number"
                    type="text"
                    required
                    value={formData.roll_number}
                    onChange={(e) =>
                      handleChange("roll_number", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="field-grade-level"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Grade Level
                  </label>
                  <input
                    id="field-grade-level"
                    type="text"
                    required
                    value={formData.grade_label}
                    onChange={(e) =>
                      handleChange("grade_label", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            )}

            {!edit && kind === "teachers" && (
              <div>
                <label
                  htmlFor="field-employee-code"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Employee Code
                </label>
                <input
                  id="field-employee-code"
                  type="text"
                  value={formData.employee_code}
                  onChange={(e) =>
                    handleChange("employee_code", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>
            )}
          </>
        )}

        {kind === "classes" && (
          <>
            <div>
              <label
                htmlFor="field-class-section-name"
                className="block font-semibold text-slate-700 mb-1"
              >
                Class Section Name
              </label>
              <input
                id="field-class-section-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. Grade 10-A"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            {!edit && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="field-grade"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Grade
                  </label>
                  <input
                    id="field-grade"
                    type="text"
                    value={formData.grade_label}
                    onChange={(e) =>
                      handleChange("grade_label", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="field-academic-year"
                    className="block font-semibold text-slate-700 mb-1"
                  >
                    Academic Year
                  </label>
                  <input
                    id="field-academic-year"
                    type="text"
                    value={formData.academic_year}
                    onChange={(e) =>
                      handleChange("academic_year", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {kind === "subjects" && (
          <>
            <div>
              <label
                htmlFor="field-subject-name"
                className="block font-semibold text-slate-700 mb-1"
              >
                Subject Name
              </label>
              <input
                id="field-subject-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. Advanced Mathematics"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            {!edit && (
              <div>
                <label
                  htmlFor="field-subject-code"
                  className="block font-semibold text-slate-700 mb-1"
                >
                  Subject Code
                </label>
                <input
                  id="field-subject-code"
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => handleChange("code", e.target.value)}
                  placeholder="e.g. MATH-10"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>
            )}
          </>
        )}

        {kind === "courses" && !edit && (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="field-class-section"
                className="block font-semibold text-slate-700 mb-1"
              >
                Class Section
              </label>
              <select
                id="field-class-section"
                value={formData.classroom_id}
                onChange={(e) => handleChange("classroom_id", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                {data?.classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.academic_year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="field-subject"
                className="block font-semibold text-slate-700 mb-1"
              >
                Subject
              </label>
              <select
                id="field-subject"
                value={formData.subject_id}
                onChange={(e) => handleChange("subject_id", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                {data?.subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
