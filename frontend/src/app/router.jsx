import React, { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute, RoleRoute, HomeRedirect } from "@/features/auth/guards";
import { LoadingSkeleton } from "@/components/common/states";

const Login = lazy(() => import("@/pages/Login"));
const TeacherDashboard = lazy(() => import("@/pages/teacher/Dashboard"));
const TeacherClasses = lazy(() => import("@/pages/teacher/Classes"));
const ClassAnalytics = lazy(() => import("@/pages/teacher/ClassAnalytics"));
const StudentDetail = lazy(() => import("@/pages/teacher/StudentDetail"));
const WeeklyEntry = lazy(() => import("@/pages/teacher/WeeklyEntry"));
const Interventions = lazy(() => import("@/pages/teacher/Interventions"));

const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminManagement = lazy(() => import("@/pages/admin/Management"));
const AdminImports = lazy(() => import("@/pages/admin/Imports"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));

const StudentDashboard = lazy(() => import("@/pages/student/Dashboard"));
const StudentProgress = lazy(() => import("@/pages/student/Progress"));
const StudentSupport = lazy(() => import("@/pages/student/Support"));

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <LoadingSkeleton label="Loading workspace…" />
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomeRedirect />} />

          {/* Teacher Routes */}
          <Route element={<RoleRoute role="teacher" />}>
            <Route element={<AppLayout role="teacher" />}>
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/classes" element={<TeacherClasses />} />
              <Route path="/teacher/classes/:courseId" element={<ClassAnalytics />} />
              <Route path="/teacher/classes/:courseId/weekly" element={<WeeklyEntry />} />
              <Route path="/teacher/students/:studentId" element={<StudentDetail />} />
              <Route path="/teacher/interventions" element={<Interventions />} />
            </Route>
          </Route>

          {/* School Admin Routes */}
          <Route element={<RoleRoute role="school_admin" />}>
            <Route element={<AppLayout role="school_admin" />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/teachers" element={<AdminManagement kind="teachers" />} />
              <Route path="/admin/students" element={<AdminManagement kind="students" />} />
              <Route path="/admin/classes" element={<AdminManagement kind="classes" />} />
              <Route path="/admin/subjects" element={<AdminManagement kind="subjects" />} />
              <Route path="/admin/courses" element={<AdminManagement kind="courses" />} />
              <Route path="/admin/imports" element={<AdminImports />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Student Routes */}
          <Route element={<RoleRoute role="student" />}>
            <Route element={<AppLayout role="student" />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/progress" element={<StudentProgress />} />
              <Route path="/student/goals" element={<StudentSupport goals />} />
              <Route path="/student/support" element={<StudentSupport />} />
            </Route>
          </Route>
        </Route>

        {/* 404 Not Found */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
              <span className="text-3xl font-mono font-bold text-slate-300 mb-2">404</span>
              <h1 className="text-lg font-bold text-slate-900">Page Not Found</h1>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                The requested URL does not exist in this workspace.
              </p>
              <Link
                to="/"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Return to Workspace
              </Link>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
