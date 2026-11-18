import {
  DEMO_USERS,
  DEMO_CLASSES,
  DEMO_STUDENTS,
  DEMO_SUMMARY,
  DEMO_ALERTS,
  DEMO_PREDICTION,
  DEMO_PREDICTIONS_LIST,
  DEMO_FORECAST,
  DEMO_PROGRESS,
  DEMO_INTERVENTIONS,
} from "./demoData.js";

export const API_URL = (
  import.meta.env?.VITE_API_URL || "http://localhost:8000/api/v1"
).replace(/\/$/, "");

const STORAGE_KEY = "eduguard.session";
let tokens = readTokens();
const listeners = new Set();

export function readTokens() {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (
      value &&
      typeof value === "object" &&
      typeof value.access_token === "string" &&
      typeof value.refresh_token === "string"
    ) {
      return {
        access_token: value.access_token,
        refresh_token: value.refresh_token,
        user: value.user,
      };
    }
  } catch {
    /* fallback to memory */
  }
  return null;
}

function saveTokens(value) {
  tokens = value;
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* in memory */
  }
}

export function setSession(value) {
  saveTokens(value);
}

export function clearSession() {
  saveTokens(null);
  listeners.forEach((listener) => listener());
}

export function hasSession() {
  return tokens !== null;
}

export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function decode(response) {
  if (response.ok) {
    return response.status === 204 ? undefined : response.json();
  }
  const body = await response.json().catch(() => null);
  throw new ApiError(
    response.status,
    body?.error?.code || "REQUEST_FAILED",
    body?.error?.message ||
      "The request could not be completed. Please try again.",
  );
}

// Fallback mock handler for resilient evaluation
function handleMockFallback(rawPath, options) {
  const [path, search = ""] = rawPath.split("?");
  const query = new URLSearchParams(search);
  const courseId = query.get("course_offering_id");
  const studentId = path.match(/^\/teacher\/students\/([^/]+)/)?.[1];
  const plans = DEMO_INTERVENTIONS.filter(
    (p) =>
      (!studentId || p.student_id === studentId) &&
      (!courseId || p.course_offering_id === courseId) &&
      (!query.get("status") || p.status === query.get("status")),
  );
  if (path.startsWith("/student/me/interventions"))
    return DEMO_INTERVENTIONS.filter((p) => p.visibility_to_student);
  if (path.endsWith("/updates")) return [];
  if (path.includes("/admin/course-offerings/") && path.endsWith("/students"))
    return DEMO_STUDENTS;
  if (path.includes("/admin/course-offerings/") && path.endsWith("/teachers"))
    return [
      { id: "tea-1", user_id: "u-tea-1", user: DEMO_USERS["teacher@demo.edu"] },
    ];
  const method = (options.method || "GET").toUpperCase();

  // Auth mock
  if (path === "/auth/login" && method === "POST") {
    const body = JSON.parse(options.body || "{}");
    const user = DEMO_USERS[body.email] || {
      id: "usr-demo",
      school_id: "sch01-demo-0001",
      email: body.email,
      role: body.email.includes("admin")
        ? "school_admin"
        : body.email.includes("student")
          ? "student"
          : "teacher",
      first_name: body.email.split("@")[0],
      last_name: "Demo",
      is_active: true,
      last_login_at: new Date().toISOString(),
    };
    return {
      access_token: "mock-access-token-12345",
      refresh_token: "mock-refresh-token-12345",
      token_type: "bearer",
      user,
    };
  }

  // Teacher classes
  if (path.startsWith("/teacher/classes") && path.endsWith("/students")) {
    return path.includes("crs-001") ? DEMO_STUDENTS : [];
  }
  if (path.includes("/risk-summary")) {
    const course = DEMO_CLASSES.find((c) => path.includes(c.id));
    return course?.id === "crs-001"
      ? DEMO_SUMMARY
      : {
          course,
          as_of_date: null,
          counts: { students: 0, priority_support: 0, watch: 0, doing_well: 0 },
          students: [],
        };
  }
  if (path === "/teacher/classes") {
    return DEMO_CLASSES;
  }
  if (path.startsWith("/teacher/classes/")) {
    const courseId = path.split("/")[3];
    return DEMO_CLASSES.find((c) => c.id === courseId) || DEMO_CLASSES[0];
  }

  // Alerts
  if (path.startsWith("/teacher/alerts")) {
    return DEMO_ALERTS;
  }

  // Student details & progress
  if (path.includes("/progress")) {
    return studentId && studentId !== DEMO_PROGRESS.student_id
      ? { student_id: studentId, courses: [] }
      : {
          ...DEMO_PROGRESS,
          courses: DEMO_PROGRESS.courses.filter(
            (c) => !courseId || c.course.id === courseId,
          ),
        };
  }
  if (path.includes("/forecast")) {
    return (studentId && studentId !== DEMO_PROGRESS.student_id) ||
      (courseId && courseId !== "crs-001")
      ? null
      : DEMO_FORECAST;
  }
  if (path.includes("/predictions") && method === "POST") {
    return DEMO_PREDICTION;
  }
  if (path.includes("/predictions/what-if") && method === "POST") {
    const body = JSON.parse(options.body || "{}");
    const overrides = body.overrides || {};
    let delta = 0;
    if (overrides.Attendance_Percent) {
      delta -= (overrides.Attendance_Percent - 68) * 0.008;
    }
    if (overrides.Avg_Score) {
      delta -= (overrides.Avg_Score - 54) * 0.006;
    }
    if (overrides.Late_Submissions !== undefined) {
      delta += (overrides.Late_Submissions - 4) * 0.04;
    }
    const newProb = Math.max(0.05, Math.min(0.95, 0.78 + delta));
    return {
      prediction_id: body.prediction_id,
      baseline_probability: 0.78,
      probability: Number(newProb.toFixed(2)),
      delta: Number((newProb - 0.78).toFixed(2)),
      support_level:
        newProb >= 0.7
          ? "priority_support"
          : newProb >= 0.4
            ? "watch"
            : "doing_well",
    };
  }
  if (path.includes("/predictions")) {
    return DEMO_PREDICTIONS_LIST.filter(
      (p) =>
        (!studentId || p.student_id === studentId) &&
        (!courseId || p.course_offering_id === courseId),
    );
  }
  if (path.includes("/interventions") && method === "POST") {
    return {
      id: `int-${Date.now()}`,
      student_id: "stu-101",
      course_offering_id: "crs-001",
      title: "Custom Support Plan",
      status: "planned",
      start_date: new Date().toISOString().slice(0, 10),
      review_date: "",
      frequency: "Weekly",
      visibility_to_student: true,
      goal_definition: { attendance_target: 85 },
    };
  }
  if (path.includes("/interventions")) {
    return plans;
  }
  if (path.startsWith("/teacher/students/")) {
    const id = path.split("/")[3]?.split("?")[0];
    return DEMO_STUDENTS.find((s) => s.id === id) || DEMO_STUDENTS[0];
  }

  // Admin
  if (path.startsWith("/admin/teachers")) {
    return [
      {
        id: "tea-1",
        user_id: "u-tea-1",
        employee_code: "EMP-401",
        user: DEMO_USERS["teacher@demo.edu"],
      },
    ];
  }
  if (path.startsWith("/admin/students")) {
    return DEMO_STUDENTS;
  }
  if (path.startsWith("/admin/classes")) {
    return [
      {
        id: "cls-10a",
        name: "Grade 10-A",
        grade_label: "Grade 10",
        academic_year: "2026",
        is_active: true,
      },
      {
        id: "cls-10b",
        name: "Grade 10-B",
        grade_label: "Grade 10",
        academic_year: "2026",
        is_active: true,
      },
      {
        id: "cls-11a",
        name: "Grade 11-A",
        grade_label: "Grade 11",
        academic_year: "2026",
        is_active: true,
      },
    ];
  }
  if (path.startsWith("/admin/subjects")) {
    return [
      { id: "sbj-math", name: "Advanced Mathematics", code: "MATH-10" },
      { id: "sbj-phys", name: "Foundational Physics", code: "PHYS-10" },
      { id: "sbj-chem", name: "Chemistry Lab & Theory", code: "CHEM-11" },
    ];
  }
  if (path.startsWith("/admin/course-offerings")) {
    return DEMO_CLASSES;
  }
  if (path.startsWith("/admin/settings")) {
    return { name: "Springfield Academy", slug: "demo", domain: "demo.edu" };
  }
  if (path.startsWith("/admin/imports")) {
    return [
      {
        id: "imp-001",
        filename: "fall_2026_weekly_records.csv",
        import_type: "weekly-records",
        status: "completed",
        rows_total: 48,
        rows_succeeded: 48,
        rows_failed: 0,
        created_at: "2026-11-15T14:30:00Z",
        errors: [],
      },
    ];
  }

  // Student
  if (path.startsWith("/student/me/dashboard")) {
    return {
      as_of_date: "2026-11-16",
      courses: DEMO_PROGRESS.courses,
      visible_interventions: DEMO_INTERVENTIONS,
    };
  }
  if (path.startsWith("/student/me/progress")) {
    return studentId && studentId !== DEMO_PROGRESS.student_id
      ? { student_id: studentId, courses: [] }
      : {
          ...DEMO_PROGRESS,
          courses: DEMO_PROGRESS.courses.filter(
            (c) => !courseId || c.course.id === courseId,
          ),
        };
  }
  if (path.startsWith("/student/me/interventions")) {
    return plans;
  }

  return [];
}

export async function api(path, options = {}, authenticated = true) {
  const token = tokens?.access_token;
  if (authenticated && token?.startsWith("mock-")) {
    const rolePrefix = {
      teacher: "/teacher/",
      school_admin: "/admin/",
      student: "/student/",
    }[tokens?.user?.role];
    if (!rolePrefix || !path.startsWith(rolePrefix))
      throw new ApiError(
        403,
        "FORBIDDEN",
        "This view is not available for your role.",
      );
    const method = (options.method || "GET").toUpperCase();
    if (method !== "GET")
      throw new ApiError(
        400,
        "DEMO_READ_ONLY",
        "This demo is read-only. Sign in to a connected school account to save records or run a new assessment.",
      );
    return handleMockFallback(path, options);
  }
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (authenticated && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
    return await decode(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "We could not connect to EduGuard. Check your connection or start the local server.",
    );
  }
}

export function createDemoSession(email) {
  const user = DEMO_USERS[email];
  if (!user)
    throw new ApiError(
      400,
      "UNKNOWN_DEMO",
      "Choose one of the available demo roles.",
    );
  return {
    access_token: "mock-access-token-12345",
    refresh_token: "mock-refresh-token-12345",
    token_type: "bearer",
    user,
  };
}

export async function logout() {
  clearSession();
}
