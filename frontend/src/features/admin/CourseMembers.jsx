import React, { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { adminApi, adminCourseLabel } from "@/lib/api/admin";
import { today } from "@/features/progress/metrics";
import { LoadingSkeleton } from "@/components/common/states";

export function CourseMembers({ courseId, data, onClose }) {
  const [members, setMembers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [enrolledDate, setEnrolledDate] = useState(today());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadMembers = async () => {
    try {
      const res = await adminApi.members(courseId);
      setMembers(res);
    } catch (err) {
      setError(err?.message || "Failed to load members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [courseId]);

  const handleAssignTeacher = async (e) => {
    e.preventDefault();
    if (!teacherId) return;
    try {
      await adminApi.write(`course-offerings/${courseId}/teachers`, {
        teacher_id: teacherId,
      });
      setNotice("Teacher assigned to course.");
      setTeacherId("");
      loadMembers();
    } catch (err) {
      setError(err?.message || "Failed to assign teacher.");
    }
  };

  const handleRemoveTeacher = async (tId) => {
    try {
      await adminApi.unassign(courseId, tId);
      setNotice("Teacher unassigned.");
      loadMembers();
    } catch (err) {
      setError(err?.message || "Failed to unassign teacher.");
    }
  };

  const handleEnrollStudent = async (e) => {
    e.preventDefault();
    if (!studentId) return;
    try {
      await adminApi.write(`course-offerings/${courseId}/students`, {
        student_id: studentId,
        enrolled_at: enrolledDate,
      });
      setNotice("Student enrolled successfully.");
      setStudentId("");
      loadMembers();
    } catch (err) {
      setError(err?.message || "Failed to enroll student.");
    }
  };

  const handleToggleEnrollment = async (enrollmentId, currentStatus) => {
    try {
      await adminApi.write(
        `enrollments/${enrollmentId}`,
        { status: currentStatus === "active" ? "withdrawn" : "active" },
        "PATCH",
      );
      setNotice("Enrollment status updated.");
      loadMembers();
    } catch (err) {
      setError(err?.message || "Failed to update enrollment.");
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => onClose()}
      title="Course Rosters & Personnel"
      description={adminCourseLabel(courseId, data)}
    >
      {loading ? (
        <LoadingSkeleton label="Loading course roster…" />
      ) : (
        <div className="space-y-6 text-xs">
          {notice && (
            <div className="p-2.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              {notice}
            </div>
          )}
          {error && (
            <div className="p-2.5 rounded bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Assigned Teachers */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800  text-[11px]">
              Assigned Teachers
            </h3>
            {members?.teachers?.length ? (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {members.teachers.map((t) => {
                  const teacherUser = data.teachers.find(
                    (p) => p.id === t.teacher_id,
                  )?.user;
                  return (
                    <li
                      key={t.teacher_id}
                      className="p-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {teacherUser
                            ? `${teacherUser.first_name} ${teacherUser.last_name}`
                            : "Teacher"}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {teacherUser?.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTeacher(t.teacher_id)}
                        className="text-red-600 hover:text-red-800 font-medium cursor-pointer"
                      >
                        Unassign
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-400 italic">No teachers assigned yet.</p>
            )}

            <form onSubmit={handleAssignTeacher} className="flex gap-2">
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
              >
                <option value="">Select teacher to assign…</option>
                {data.teachers
                  .filter(
                    (p) =>
                      !members?.teachers?.some((t) => t.teacher_id === p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.user?.first_name} {p.user?.last_name} ({p.user?.email})
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                disabled={!teacherId}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-md font-semibold disabled:opacity-50"
              >
                Assign
              </button>
            </form>
          </div>

          {/* Enrolled Students */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <h3 className="font-bold text-slate-800  text-[11px]">
              Enrolled Students ({members?.students?.length || 0})
            </h3>
            {members?.students?.length ? (
              <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {members.students.map((s) => {
                  const studentObj = data.students.find(
                    (p) => p.id === s.student_id,
                  );
                  return (
                    <li
                      key={s.id}
                      className="p-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {studentObj?.user
                            ? `${studentObj.user.first_name} ${studentObj.user.last_name}`
                            : "Student"}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {studentObj?.roll_number} · Status:{" "}
                          <strong>{s.status}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleEnrollment(s.id, s.status)}
                        className="text-slate-600 hover:text-slate-900 font-medium underline"
                      >
                        {s.status === "active" ? "Withdraw" : "Re-enroll"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-slate-400 italic">No students enrolled yet.</p>
            )}

            <form
              onSubmit={handleEnrollStudent}
              className="flex flex-col sm:flex-row gap-2"
            >
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800"
              >
                <option value="">Select student to enroll…</option>
                {data.students
                  .filter(
                    (p) =>
                      !members?.students?.some((s) => s.student_id === p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.user?.first_name} {p.user?.last_name} (Roll:{" "}
                      {p.roll_number})
                    </option>
                  ))}
              </select>
              <input
                type="date"
                value={enrolledDate}
                onChange={(e) => setEnrolledDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800 font-mono"
              />
              <button
                type="submit"
                disabled={!studentId}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-md font-semibold disabled:opacity-50"
              >
                Enroll
              </button>
            </form>
          </div>
        </div>
      )}
    </Modal>
  );
}
