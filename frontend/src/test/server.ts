import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { API_URL } from "@/lib/api/client";
import { course, session, student, summary, teacher } from "./fixtures";
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
  http.get(`${API_URL}/teacher/classes`, () => HttpResponse.json([course])),
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
