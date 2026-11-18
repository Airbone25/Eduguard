import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context";
import { roleHome } from "@/lib/utils";

export function ProtectedRoute() {
  const { user, pending } = useAuth();

  if (pending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Restoring your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RoleRoute({ role }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={roleHome[user.role] || "/login"} replace />;
  }

  return <Outlet />;
}

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome[user.role] || "/login"} replace />;
}
