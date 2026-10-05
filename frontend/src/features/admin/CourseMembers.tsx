import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton, ErrorState } from "@/components/common/states";
import { adminApi, adminCourseLabel, type Catalog } from "./api";
import { today } from "@/features/progress/metrics";
export function CourseMembers({
  course,
  data,
  onClose,
}: {
  course: string;
  data: Catalog;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "members", course],
    queryFn: ({ signal }) => adminApi.members(course, signal),
  });
  const [teacher, setTeacher] = useState("");
  const [student, setStudent] = useState("");
  const [date, setDate] = useState(today());
  const [remove, setRemove] = useState("");
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      setNotice("Course people updated.");
      setRemove("");
    },
  });
  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o && !mutation.isPending) onClose();
      }}
      title="Course people"
      description={adminCourseLabel(course, data)}
    >
      {query.isPending ? (
        <LoadingSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="stack">
          {notice && <p role="status">{notice}</p>}
          {mutation.error && <p role="alert">{mutation.error.message}</p>}
          <h3>Teachers</h3>
          <ul>
            {query.data.teachers.map((t) => (
              <li key={t.teacher_id}>
                {data.teachers.find((p) => p.id === t.teacher_id)?.user.email ??
                  "Teacher"}{" "}
                {remove === t.teacher_id ? (
                  <Button
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate(() =>
                        adminApi.unassign(course, t.teacher_id),
                      )
                    }
                  >
                    Confirm removal
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setRemove(t.teacher_id)}
                  >
                    Remove assignment
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (teacher)
                mutation.mutate(() =>
                  adminApi.write(`course-offerings/${course}/teachers`, {
                    teacher_id: teacher,
                  }),
                );
            }}
          >
            <label>
              Teacher
              <select
                required
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              >
                <option value="">Choose teacher</option>
                {data.teachers
                  .filter(
                    (p) =>
                      p.user.is_active &&
                      !query.data.teachers.some((t) => t.teacher_id === p.id),
                  )
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.user.first_name} {p.user.last_name} · {p.user.email}
                    </option>
                  ))}
              </select>
            </label>
            <Button disabled={mutation.isPending || !teacher}>
              Assign teacher
            </Button>
          </form>
          <h3>Students</h3>
          <ul>
            {query.data.students.map((s) => (
              <li key={s.id}>
                {data.students.find((p) => p.id === s.student_id)?.user.email ??
                  "Student"}{" "}
                · {s.status}
                <Button
                  disabled={mutation.isPending}
                  variant="ghost"
                  onClick={() =>
                    mutation.mutate(() =>
                      adminApi.write(
                        `enrollments/${s.id}`,
                        {
                          status:
                            s.status === "active" ? "withdrawn" : "active",
                        },
                        "PATCH",
                      ),
                    )
                  }
                >
                  {s.status === "active" ? "Withdraw" : "Re-enroll"}
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (student && date)
                mutation.mutate(() =>
                  adminApi.write(`course-offerings/${course}/students`, {
                    student_id: student,
                    enrolled_at: date,
                  }),
                );
            }}
          >
            <label>
              Student
              <select
                required
                value={student}
                onChange={(e) => setStudent(e.target.value)}
              >
                <option value="">Choose student</option>
                {data.students
                  .filter(
                    (p) =>
                      p.user.is_active &&
                      !query.data.students.some((s) => s.student_id === p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.user.first_name} {p.user.last_name} · {p.roll_number}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Enrolled on
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <Button disabled={mutation.isPending || !student}>
              Enroll student
            </Button>
          </form>
        </div>
      )}
    </Modal>
  );
}
