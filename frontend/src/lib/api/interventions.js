import { api } from "./client";
import { allPages } from "./pagination";

export const interventionApi = {
  list: (studentId, courseId, signal) =>
    allPages(
      `/teacher/students/${encodeURIComponent(studentId)}/interventions?course_offering_id=${encodeURIComponent(courseId)}`,
      signal,
    ),
  all: (courseId, status, signal) =>
    allPages(
      `/teacher/interventions?${new URLSearchParams({
        ...(courseId ? { course_offering_id: courseId } : {}),
        ...(status ? { status } : {}),
      })}`,
      signal,
    ),
  create: (studentId, courseId, values, predictionId) =>
    api(`/teacher/students/${encodeURIComponent(studentId)}/interventions`, {
      method: "POST",
      body: JSON.stringify({
        course_offering_id: courseId,
        prediction_id: predictionId || null,
        title: values.title,
        template_id: values.template_id || null,
        start_date: values.start_date,
        review_date: values.review_date || null,
        frequency: values.frequency || null,
        visibility_to_student: Boolean(values.visibility_to_student),
        goal_definition: {
          attendance_target: values.attendance_target ? Number(values.attendance_target) : null,
          assessment_avg_score_target: values.assessment_avg_score_target ? Number(values.assessment_avg_score_target) : null,
        },
      }),
    }),
  patch: (id, body) =>
    api(`/teacher/interventions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  complete: (id) =>
    api(`/teacher/interventions/${encodeURIComponent(id)}/complete`, {
      method: "POST",
    }),
  updates: (id, signal) =>
    allPages(`/teacher/interventions/${encodeURIComponent(id)}/updates`, signal),
  note: (id, note) =>
    api(`/teacher/interventions/${encodeURIComponent(id)}/updates`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
};
