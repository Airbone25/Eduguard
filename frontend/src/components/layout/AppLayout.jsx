import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
  FileSpreadsheet,
  Settings,
  ChartNoAxesCombined,
  Target,
} from "lucide-react";
import { useAuth } from "@/features/auth/context";
import { roleHome, roleLabel } from "@/lib/utils";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <BookOpen size={23} strokeWidth={1.7} />
      </span>
      <span>
        EduGuard<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
const navigation = {
  teacher: [
    ["/teacher/dashboard", "Overview", LayoutDashboard],
    ["/teacher/classes", "My classes", BookOpen],
    ["/teacher/interventions", "Support plans", GraduationCap],
  ],
  school_admin: [
    ["/admin/dashboard", "Overview", LayoutDashboard],
    ["/admin/teachers", "Teachers", Users],
    ["/admin/students", "Students", GraduationCap],
    ["/admin/classes", "Classes", BookOpen],
    ["/admin/subjects", "Subjects", BookOpen],
    ["/admin/courses", "Course offerings", BookOpen],
    ["/admin/imports", "CSV imports", FileSpreadsheet],
    ["/admin/settings", "School settings", Settings],
  ],
  student: [
    ["/student/dashboard", "My overview", LayoutDashboard],
    ["/student/progress", "My progress", ChartNoAxesCombined],
    ["/student/goals", "My goals", Target],
    ["/student/support", "My support", GraduationCap],
  ],
};
export function AppLayout({ role }) {
  const { user, signOut, isDemo } = useAuth();
  const location = useLocation();
  const drawer = useRef(null);
  const menuButton = useRef(null);
  const links = navigation[role] || [];
  const active =
    links.find(([path]) => location.pathname.startsWith(path))?.[1] ||
    (location.pathname.includes("students/")
      ? "Student profile"
      : "Class workspace");
  useEffect(() => {
    drawer.current?.close();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const closeMenu = () => {
    drawer.current?.close();
    menuButton.current?.focus();
  };
  const rail = (
    <>
      <Link
        className="brand-link"
        to={roleHome[role]}
        aria-label="EduGuard home"
      >
        <Brand />
      </Link>
      <div className="workspace-label">{roleLabel[role]} workspace</div>
      <nav aria-label="Main navigation">
        {links.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            onClick={closeMenu}
            className={({ isActive }) =>
              `nav-link${isActive ? " is-active" : ""}`
            }
          >
            <Icon size={19} strokeWidth={1.7} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="rail-note">
        <span className="rail-note-title">
          {role === "student"
            ? "One week at a time."
            : "A little attention.\nA lasting difference."}
        </span>
        <p>
          {role === "student"
            ? "Your progress, goals, and support in one place."
            : "Notice the change. Understand the story. Make a plan together."}
        </p>
        <BookOpen size={29} strokeWidth={1.2} />
      </div>
      <div className="rail-account">
        <span className="avatar">
          {user?.first_name?.[0]}
          {user?.last_name?.[0]}
        </span>
        <span>
          <strong>
            {user?.first_name} {user?.last_name}
          </strong>
          <small>{roleLabel[role]}</small>
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={signOut}
          aria-label="Sign out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="app-rail">{rail}</aside>
      <dialog
        ref={drawer}
        className="mobile-drawer"
        onCancel={closeMenu}
        onClick={(e) => {
          if (e.target === drawer.current) closeMenu();
        }}
      >
        <button
          type="button"
          className="icon-button drawer-close"
          aria-label="Close navigation"
          onClick={closeMenu}
        >
          <X size={21} />
        </button>
        {rail}
      </dialog>
      <div className="app-body">
        <header className="app-topbar">
          <div className="breadcrumb">
            <button
              type="button"
              ref={menuButton}
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              onClick={() => drawer.current?.showModal()}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">{roleLabel[role]} workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{active}</strong>
          </div>
          <span className="privacy-note">
            <ShieldCheck size={16} />
            {role === "student"
              ? "Your personal learning space"
              : "Teacher insight. Human decisions."}
          </span>
        </header>
        {isDemo && (
          <div className="demo-notice">
            <strong>Demo workspace</strong>
            <span>/</span>Synthetic examples · changes are not saved
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="app-main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>EduGuard · Student support, thoughtfully connected.</span>
          <span>
            {role === "student"
              ? "Keep in touch with your teacher."
              : "Signals guide a conversation. They are not a diagnosis."}
          </span>
        </footer>
      </div>
    </div>
  );
}
