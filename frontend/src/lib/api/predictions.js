import { api } from "./client";

export const predictionsApi = {
  list: (studentId, courseId, offset = 0, signal) =>
    api(
      `/teacher/students/${encodeURIComponent(studentId)}/predictions?course_offering_id=${encodeURIComponent(courseId)}&limit=100&offset=${offset}`,
      { signal },
    ),
  forecast: (studentId, courseId, signal) =>
    api(
      `/teacher/students/${encodeURIComponent(studentId)}/forecast?course_offering_id=${encodeURIComponent(courseId)}`,
      { signal },
    ),
  predict: (studentId, courseId, asOfDate) =>
    api(`/teacher/students/${encodeURIComponent(studentId)}/predictions`, {
      method: "POST",
      body: JSON.stringify({
        course_offering_id: courseId,
        as_of_date: asOfDate,
      }),
    }),
  whatIf: (predictionId, overrides) =>
    api("/teacher/predictions/what-if", {
      method: "POST",
      body: JSON.stringify({
        prediction_id: predictionId,
        overrides,
      }),
    }),
};
