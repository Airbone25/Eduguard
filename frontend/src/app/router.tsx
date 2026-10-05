import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ProtectedRoute,
  RoleRoute,
  HomeRedirect,
} from "@/features/auth/guards";
import { LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/teacher/Dashboard"));
const Classes = lazy(() => import("@/pages/teacher/Classes"));
const ClassDetail = lazy(() => import("@/pages/teacher/ClassAnalytics"));
const StudentDetail = lazy(() => import("@/pages/teacher/StudentDetail"));
const WeeklyEntry = lazy(() => import("@/pages/teacher/WeeklyEntry"));
const Interventions = lazy(() => import("@/pages/teacher/Interventions"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Management = lazy(() => import("@/pages/admin/Management"));
const Imports = lazy(() => import("@/pages/admin/Imports"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const StudentDashboard = lazy(() => import("@/pages/student/Dashboard"));
const Progress = lazy(() => import("@/pages/student/Progress"));
const Support = lazy(() => import("@/pages/student/Support"));

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="session-screen">
          <LoadingSkeleton />
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route element={<RoleRoute role="teacher" />}>
            <Route element={<AppLayout role="teacher" />}>
              <Route path="/teacher/dashboard" element={<Dashboard />} />
              <Route path="/teacher/classes" element={<Classes />} />
              <Route
                path="/teacher/classes/:courseId/weekly"
                element={<WeeklyEntry />}
              />
              <Route
                path="/teacher/interventions"
                element={<Interventions />}
              />
              <Route
                path="/teacher/classes/:courseId"
                element={<ClassDetail />}
              />
              <Route
                path="/teacher/students/:studentId"
                element={<StudentDetail />}
              />
            </Route>
          </Route>
          <Route element={<RoleRoute role="school_admin" />}>
            <Route element={<AppLayout role="school_admin" />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              {(
                [
                  "teachers",
                  "students",
                  "classes",
                  "subjects",
                  "courses",
                ] as const
              ).map((kind) => (
                <Route
                  key={kind}
                  path={`/admin/${kind}`}
                  element={<Management key={kind} kind={kind} />}
                />
              ))}
              <Route path="/admin/imports" element={<Imports />} />
              <Route path="/admin/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route element={<RoleRoute role="student" />}>
            <Route element={<AppLayout role="student" />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/progress" element={<Progress />} />
              <Route path="/student/goals" element={<Support goals />} />
              <Route path="/student/support" element={<Support />} />
            </Route>
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <main className="not-found">
              <h1>This page isn’t here</h1>
              <p>Head back to your workspace to continue.</p>
              <Button asChild>
                <Link to="/">Go to my workspace</Link>
              </Button>
            </main>
          }
        />
      </Routes>
    </Suspense>
  );
}
