import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./server";
import { API_URL, setSession } from "@/lib/api/client";
import { session, student } from "./fixtures";
import { renderApp } from "./render";
import {
  interventionSchema,
  interventionPayload,
} from "@/features/interventions/schema";
const progress = {
  student_id: student.id,
  as_of_date: "2026-10-04",
  courses: [
    {
      course: {
        id: "course-1",
        classroom_name: "Grade 10-A",
        subject_name: "Math",
        subject_code: "MATH",
        academic_year: "2026",
      },
      attendance: { current: 80, change_4wk: -10, trend: "declining" },
      academic: { current: 65, change_4wk: -12, trend: "declining" },
      assignments: {
        total: 4,
        completed: 3,
        completion_percent: 75,
        on_time_streak_weeks: null,
      },
      improvements: [],
      weeks: [],
    },
  ],
};
const prediction = {
  id: "prediction-1",
  as_of_date: "2026-10-01",
  created_at: "2026-10-01T12:00:00Z",
  model_version: "existing-v1",
  support_level: "priority_support",
  signals: [
    { code: "attendance", message: "Attendance decreased by 10 points." },
  ],
  recommendations: [
    {
      template_id: "template-1",
      name: "Attendance check-in",
      reason: "Attendance declined.",
    },
  ],
};
const plan = {
  id: "plan-1",
  student_id: student.id,
  course_offering_id: "course-1",
  title: "Attendance check-in",
  status: "planned",
  start_date: "2026-10-04",
  review_date: "2026-10-18",
  frequency: "Weekly",
  visibility_to_student: true,
  goal_definition: { attendance_target: 90 },
  created_at: "2026-10-04T10:00:00Z",
  updated_at: "2026-10-04T10:00:00Z",
};
describe("Teacher support workflow", () => {
  it("validates date order and goals while omitting missing optional goals", () => {
    const input = {
      title: "Plan",
      template_id: "",
      start_date: "2026-10-04",
      review_date: "2026-10-03",
      frequency: "Weekly",
      attendance_target: "101",
      assessment_avg_score_target: "",
      visibility_to_student: false,
    };
    expect(interventionSchema.safeParse(input).success).toBe(false);
    const valid = { ...input, review_date: "", attendance_target: "0" };
    expect(interventionSchema.safeParse(valid).success).toBe(true);
    expect(interventionPayload(valid, "course-1").goal_definition).toEqual({
      attendance_target: 0,
    });
  });
  it("shows exact backend signals and creates a plan only after explicit save", async () => {
    let saved: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_URL}/teacher/students/:id/progress`, () =>
        HttpResponse.json(progress),
      ),
      http.get(`${API_URL}/teacher/students/:id/predictions`, () =>
        HttpResponse.json([prediction]),
      ),
      http.get(`${API_URL}/teacher/students/:id/interventions`, () =>
        HttpResponse.json(saved ? [plan] : []),
      ),
      http.post(
        `${API_URL}/teacher/students/:id/interventions`,
        async ({ request }) => {
          saved = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(plan, { status: 201 });
        },
      ),
    );
    setSession(session);
    const user = userEvent.setup();
    renderApp("/teacher/students/student-1?course=course-1");
    expect(
      await screen.findByText("Attendance decreased by 10 points."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Interventions" }));
    expect(await screen.findByText("Attendance declined.")).toBeVisible();
    expect(saved).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Start intervention" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Start a support plan" });
    await user.type(
      within(dialog).getByLabelText("Frequency (optional)"),
      "Weekly",
    );
    await user.type(
      within(dialog).getByLabelText("Attendance target (%)"),
      "90",
    );
    await user.click(
      within(dialog).getByLabelText(
        "Show this plan and its goals to the student",
      ),
    );
    expect(saved).toBeNull();
    await user.click(
      within(dialog).getByRole("button", { name: "Save support plan" }),
    );
    expect(await screen.findByText("Support plan created.")).toBeVisible();
    expect(saved).toMatchObject({
      template_id: "template-1",
      prediction_id: "prediction-1",
      course_offering_id: "course-1",
      frequency: "Weekly",
      visibility_to_student: true,
      goal_definition: { attendance_target: 90 },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("adds a private follow-up and confirms completion before posting", async () => {
    let completed = false;
    let note = "";
    server.use(
      http.get(`${API_URL}/teacher/interventions`, () =>
        HttpResponse.json([
          { ...plan, status: completed ? "completed" : "active" },
        ]),
      ),
      http.get(`${API_URL}/teacher/interventions/:id/updates`, () =>
        HttpResponse.json(
          note
            ? [
                {
                  id: "u1",
                  sequence: 1,
                  kind: "note",
                  note,
                  created_at: "2026-10-04T10:00:00Z",
                },
              ]
            : [],
        ),
      ),
      http.post(
        `${API_URL}/teacher/interventions/:id/updates`,
        async ({ request }) => {
          note = ((await request.json()) as { note: string }).note;
          return HttpResponse.json({ id: "u1" });
        },
      ),
      http.post(`${API_URL}/teacher/interventions/:id/complete`, () => {
        completed = true;
        return HttpResponse.json({ ...plan, status: "completed" });
      }),
    );
    setSession(session);
    const user = userEvent.setup();
    renderApp("/teacher/interventions");
    await user.click(
      await screen.findByRole("button", { name: "View follow-ups" }),
    );
    await user.type(
      screen.getByLabelText("Private teacher follow-up"),
      "Reviewed attendance together.",
    );
    await user.click(screen.getByRole("button", { name: "Save follow-up" }));
    expect(await screen.findByText("Follow-up saved.")).toBeVisible();
    expect(note).toBe("Reviewed attendance together.");
    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(completed).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Confirm status change" }),
    );
    expect(
      await within(screen.getByRole("article")).findByText("completed", {
        exact: true,
      }),
    ).toBeVisible();
    expect(completed).toBe(true);
  });
});
