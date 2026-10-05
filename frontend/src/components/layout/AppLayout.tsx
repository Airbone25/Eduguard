import { useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/features/auth/context";
import { roleHome, roleLabel } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { Role } from "@/types/api";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <ShieldCheck size={23} strokeWidth={1.7} />
      </span>
      <span>
        EduGuard<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function AppLayout({ role }: { role: Role }) {
  const { user, signOut } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const label = location.pathname.includes("/students/")
    ? "Student overview"
    : location.pathname.includes("/classes")
      ? "My classes"
      : "Overview";
  const navigation = (
    <>
      <Link
        className="brand-link"
        to={roleHome[role]}
        onClick={() => setSidebarOpen(false)}
        aria-label="EduGuard home"
      >
        <Brand />
      </Link>
      <p className="nav-section">{roleLabel[role]}</p>
      <nav aria-label="Main navigation">
        <NavLink to={roleHome[role]} onClick={() => setSidebarOpen(false)}>
          <LayoutDashboard size={19} />
          {role === "student" ? "My home" : "Overview"}
        </NavLink>
        {role === "school_admin" &&
          [
            "teachers",
            "students",
            "classes",
            "subjects",
            "courses",
            "imports",
            "settings",
          ].map((path) => (
            <NavLink
              key={path}
              to={`/admin/${path}`}
              onClick={() => setSidebarOpen(false)}
            >
              <BookOpen size={19} />
              {path[0].toUpperCase() + path.slice(1)}
            </NavLink>
          ))}
        {role === "student" &&
          ["progress", "goals", "support"].map((path) => (
            <NavLink
              key={path}
              to={`/student/${path}`}
              onClick={() => setSidebarOpen(false)}
            >
              <BookOpen size={19} />
              {path === "progress"
                ? "My progress"
                : path === "goals"
                  ? "Goals & achievements"
                  : "My support"}
            </NavLink>
          ))}
        {role === "teacher" && (
          <>
            <NavLink
              to="/teacher/classes"
              onClick={() => setSidebarOpen(false)}
            >
              <BookOpen size={19} />
              My classes
            </NavLink>
            <NavLink
              to="/teacher/interventions"
              onClick={() => setSidebarOpen(false)}
            >
              <GraduationCap size={19} />
              Support plans
            </NavLink>
          </>
        )}
      </nav>
      <div className="sidebar-note">
        <span className="note-icon">
          <GraduationCap size={24} />
        </span>
        <h3>Every student matters.</h3>
        <p>Small steps. Meaningful progress. Support starts with you.</p>
      </div>
      <div className="sidebar-footer">
        <ShieldCheck size={15} />
        <span>A space for student growth</span>
      </div>
    </>
  );
  return (
    <div className={`app-shell role-${role}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar">{navigation}</aside>
      <Sheet
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        returnFocusRef={menuTrigger}
      >
        {navigation}
      </Sheet>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              className="mobile-menu"
              ref={menuTrigger}
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </Button>
            <span className="breadcrumb">
              {role === "teacher" ? "Workspace" : roleLabel[role]}{" "}
              <span>/</span> <strong>{label}</strong>
            </span>
          </div>
          <div className="account">
            <span className="avatar">
              {user?.first_name.slice(0, 1)}
              {user?.last_name.slice(0, 1)}
            </span>
            <div className="account-info">
              <strong>
                {user?.first_name} {user?.last_name}
              </strong>
              <span>{roleLabel[role]}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true);
                void signOut();
              }}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>
            EduGuard <span aria-hidden="true">·</span> Supporting potential
          </span>
          <span>Insights inform. Teachers decide.</span>
        </footer>
      </div>
    </div>
  );
}
