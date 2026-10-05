import { describe, it, expect } from "vitest";
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { API_URL, setSession } from "@/lib/api/client";
import { achievements } from "@/features/progress/student";
import type { CourseProgress } from "@/types/api";
import { renderApp } from "./render";
import { server } from "./server";
import { teacher, session } from "./fixtures";
const measured: CourseProgress = {
  course: {
    id: "c1",
    classroom_name: "10-A",
    subject_name: "Mathematics",
    subject_code: "MATH",
    academic_year: "2026",
  },
  attendance: { current: 90, change_4wk: 10, trend: "improving" },
  academic: { current: 80, change_4wk: 5, trend: "improving" },
  assignments: {
    total: 5,
    completed: 5,
    completion_percent: 100,
    on_time_streak_weeks: 3,
  },
  improvements: [{ code: "score_improvement", value: 5 }],
  weeks: [
    {
      week_start: "2026-09-28",
      attendance_percent: 90,
      assessment_avg_score: 80,
      assignment_count: 5,
      assignments_completed: 5,
      late_submissions: 0,
    },
  ],
};
const plan = {
  id: "p1",
  course_offering_id: "c1",
  title: "Weekly reading together",
  status: "active",
  start_date: "2026-09-28",
  review_date: null,
  completed_at: null,
  goal_definition: { attendance_target: 85 },
  risk_probability: 0.987654,
  at_risk: true,
  private_notes: "SECRET TEACHER NOTE",
};
function studentSession() {
  setSession(session);
  server.use(
    http.get(`${API_URL}/auth/me`, () =>
      HttpResponse.json({ ...teacher, role: "student" }),
    ),
    http.get(`${API_URL}/student/me/dashboard`, () =>
      HttpResponse.json({
        student_id: "s1",
        as_of_date: "2026-10-03",
        courses: [measured],
        visible_interventions: [plan],
        goals: [],
        risk_probability: 0.987654,
        at_risk: true,
        private_notes: "SECRET TEACHER NOTE",
      }),
    ),
    http.get(`${API_URL}/student/me/interventions`, () =>
      HttpResponse.json([plan]),
    ),
  );
}
describe("Student progress privacy", () => {
  it.each(["/student/dashboard", "/student/goals", "/student/support"])(
    "renders safe measured progress on %s without internal fields",
    async (path) => {
      studentSession();
      renderApp(path);
      await screen.findAllByText("Weekly reading together");
      expect(document.body.textContent).not.toMatch(
        /risk_probability|0\.987654|at_risk|SECRET TEACHER NOTE|Priority Support/,
      );
      expect(await screen.findByText(/Target reached/)).toBeVisible();
    },
  );
  it("requests extended term history and switches accessible chart values", async () => {
    studentSession();
    const ranges: string[] = [];
    server.use(
      http.get(`${API_URL}/student/me/progress`, ({ request }) => {
        ranges.push(
          new URL(request.url).searchParams.get("history_weeks") ?? "",
        );
        return HttpResponse.json({
          student_id: "s1",
          as_of_date: "2026-10-03",
          courses: [measured],
        });
      }),
    );
    const user = userEvent.setup();
    renderApp("/student/progress");
    await screen.findByRole("heading", { name: "Assessment scores" });
    await user.selectOptions(screen.getByLabelText("Time range"), "52");
    await screen.findByText(/Choose the term start and end dates/);
    fireEvent.input(screen.getByLabelText("Term start"), {
      target: { value: "2026-08-03" },
    });
    fireEvent.input(screen.getByLabelText("Term end"), {
      target: { value: "2026-10-03" },
    });
    await waitFor(() => expect(ranges).toContain("9"));
    await user.click(screen.getByRole("button", { name: "Attendance" }));
    await screen.findByRole("heading", { name: "Attendance" });
  });
  it("does not invent achievements from missing measurements", () => {
    expect(
      achievements({
        ...measured,
        weeks: [],
        improvements: [],
        assignments: {
          total: null,
          completed: null,
          completion_percent: null,
          on_time_streak_weeks: null,
        },
      }),
    ).toEqual([]);
  });
});
describe("Admin workflows", () => {
  function admin() {
    setSession(session);
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({ ...teacher, role: "school_admin" }),
      ),
    );
  }
  it("validates user creation and sends only the chosen role form", async () => {
    admin();
    let payload: unknown;
    server.use(
      http.post(`${API_URL}/admin/teachers`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({ id: "t2" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/teachers");
    await user.click(
      await screen.findByRole("button", { name: "Add teacher" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Save" }));
    expect(payload).toBeUndefined();
    await user.type(dialog.getByLabelText("First name"), "Nora");
    await user.type(dialog.getByLabelText("Last name"), "Lee");
    await user.type(dialog.getByLabelText("Email"), "nora@example.test");
    await user.type(
      dialog.getByLabelText(/Initial password/),
      "Demo-Safe-2026!",
    );
    await user.type(dialog.getByLabelText("Employee code"), "T002");
    await user.click(dialog.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved successfully.");
    expect(payload).toEqual({
      first_name: "Nora",
      last_name: "Lee",
      email: "nora@example.test",
      password: "Demo-Safe-2026!",
      employee_code: "T002",
    });
  });
  it("requires server validation before confirming CSV import; hides password preview", async () => {
    admin();
    const calls: string[] = [];
    server.use(
      http.post(`${API_URL}/admin/imports/students`, async ({ request }) => {
        const multipart = await request.text();
        const dry =
          /name="dry_run"\r\n\r\n(true|false)/.exec(multipart)?.[1] ??
          "missing";
        calls.push(dry);
        return HttpResponse.json({
          id: "job1",
          filename: "students.csv",
          import_type: "students",
          status: dry === "true" ? "validated" : "succeeded",
          rows_total: 1,
          rows_succeeded: dry === "true" ? 0 : 1,
          rows_failed: 0,
          errors: [],
          created_at: "2026-10-03",
          initial_credentials: [],
        });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/imports");
    await user.type(await screen.findByLabelText("Academic year"), "2026");
    const file = new File(
      [
        "email,first_name,last_name,roll_number,grade,class_name,password\na@b.test,A,B,S1,10,10-A,Secret-Password-2026!",
      ],
      "students.csv",
      { type: "text/csv" },
    );
    await user.upload(screen.getByLabelText(/CSV file/), file);
    await screen.findByText("Preview · 1 rows");
    expect(screen.queryByText("Secret-Password-2026!")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Confirm import/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Validate CSV" }));
    await user.click(
      await screen.findByRole("button", { name: "Confirm import of 1 rows" }),
    );
    await waitFor(() => expect(calls).toEqual(["true", "false"]));
    await screen.findByText("succeeded", { exact: true });
    expect(
      screen.queryByRole("button", { name: /Confirm import/ }),
    ).not.toBeInTheDocument();
  });
});
