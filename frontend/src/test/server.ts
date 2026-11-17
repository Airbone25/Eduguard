import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { API_URL } from "@/lib/api/client";
import { course, prediction, session, student, summary, teacher } from "./fixtures";
export const server = setupServer(
  http.get(`${API_URL}/student/me/dashboard`, () =>
    HttpResponse.json({
      student_id: "student-1",
      as_of_date: "2026-10-03",
      courses: [],
      visible_interventions: [],
      goals: [],
      interventions_has_more: false,
    }),
  ),
  ...[
    "teachers",
    "students",
    "classes",
    "subjects",
    "course-offerings",
    "imports",
  ].map((path) =>
    http.get(`${API_URL}/admin/${path}`, () => HttpResponse.json([])),
  ),
  http.get(`${API_URL}/teacher/students/:id/predictions`, () =>
    HttpResponse.json([]),
  ),
  http.get(`${API_URL}/teacher/students/:id/forecast`, () =>
    HttpResponse.json({
      student_id: student.id,
      course_offering_id: course.id,
      as_of_date: "2026-10-01",
      history_weeks: 6,
      horizon_weeks: 4,
      band_level: 0.8,
      model_version: "trained-synthetic-v1-seed2026",
      method: "Forward-simulated weekly trends",
      points: [
        { week_start: "2026-10-05", horizon: 1, risk_probability: 0.62, band_low: 0.55, band_high: 0.7 },
        { week_start: "2026-10-12", horizon: 2, risk_probability: 0.66, band_low: 0.53, band_high: 0.78 },
        { week_start: "2026-10-19", horizon: 3, risk_probability: 0.69, band_low: 0.5, band_high: 0.84 },
        { week_start: "2026-10-26", horizon: 4, risk_probability: 0.72, band_low: 0.47, band_high: 0.89 },
      ],
    }),
  ),
  http.post(`${API_URL}/auth/login`, () => HttpResponse.json(session)),
  http.get(`${API_URL}/auth/me`, () => HttpResponse.json(teacher)),
  http.post(`${API_URL}/auth/refresh`, () =>
    HttpResponse.json({
      ...session,
      access_token: "access-2",
      refresh_token: "refresh-2",
    }),
  ),
  http.post(
    `${API_URL}/auth/logout`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(`${API_URL}/teacher/predictions/what-if`, async ({ request }) => {
    const body = (await request.json()) as {
      overrides?: Record<string, number>;
    };
    const attendance = body.overrides?.Attendance_Percent;
    const probability = attendance !== undefined && attendance >= 90 ? 0.05 : 0.4;
    return HttpResponse.json({
      prediction_id: prediction.id,
      baseline_probability: prediction.risk_probability,
      baseline_support_level: prediction.support_level,
      probability,
      support_level: probability >= 0.62 ? "priority_support" : probability >= 0.12 ? "watch" : "doing_well",
      delta: Number((probability - prediction.risk_probability).toFixed(6)),
      applied_overrides: body.overrides ?? {},
    });
  }),
  http.get(`${API_URL}/teacher/classes`, () => HttpResponse.json([course])),
  http.get(`${API_URL}/teacher/alerts`, () =>
    HttpResponse.json({
      as_of_date: "2026-10-03",
      counts: {
        total: 0,
        declining: 0,
        needs_support: 0,
        new_data: 0,
        improving: 0,
      },
      alerts: [],
      limit: 200,
      offset: 0,
    }),
  ),
  http.get(`${API_URL}/teacher/classes/:id/risk-summary`, () =>
    HttpResponse.json(summary),
  ),
  http.get(`${API_URL}/teacher/classes/:id/students`, () =>
    HttpResponse.json([student]),
  ),
  http.get(`${API_URL}/teacher/students/:id`, () => HttpResponse.json(student)),
  http.get(`${API_URL}/teacher/students/:id/progress`, () =>
    HttpResponse.json({
      student_id: student.id,
      as_of_date: "2026-10-03",
      courses: [],
    }),
  ),
);
