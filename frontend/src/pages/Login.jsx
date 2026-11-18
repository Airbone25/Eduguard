import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  GraduationCap,
  Users,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/features/auth/context";
import { roleHome } from "@/lib/utils";
import { Brand } from "@/components/layout/AppLayout";
export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [schoolSlug, setSchoolSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  if (auth.user)
    return <Navigate to={roleHome[auth.user.role] || "/"} replace />;
  const signIn = async (credentials) => {
    setServerError("");
    setSubmitting(true);
    try {
      const user = await auth.signIn(credentials);
      navigate(roleHome[user.role], { replace: true });
    } catch (err) {
      setServerError(
        err?.message ||
          "Sign-in failed. Check your school code, email, and password.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-body">
          <h1>
            Every student <br />
            has a story.
            <br />
            <em>Stay close to it.</em>
          </h1>
          <p>
            Connect the small changes in attendance, learning, and participation
            to the support that comes next.
          </p>
          <ol className="journey-list">
            <li>
              <span>Notice</span>
              <p>Bring weekly observations together.</p>
            </li>
            <li>
              <span>Understand</span>
              <p>Look at the evidence behind a change.</p>
            </li>
            <li>
              <span>Support</span>
              <p>Build a plan. Follow progress together.</p>
            </li>
          </ol>
        </div>
        <div className="login-promise">
          <ShieldCheck size={18} />
          <span>Insights inform. Educators decide.</span>
        </div>
      </section>
      <main className="login-main">
        <div className="login-form-wrap">
          <h2>Welcome to EduGuard.</h2>
          <p className="login-intro">Sign in to your school workspace.</p>
          {auth.logoutWarning && (
            <p role="status" className="form-notice">
              {auth.logoutWarning}
            </p>
          )}
          {serverError && (
            <p role="alert" className="form-error">
              {serverError}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn({
                school_slug: schoolSlug.trim(),
                email: email.trim(),
                password,
              });
            }}
          >
            <label htmlFor="school-slug">School code</label>
            <input
              id="school-slug"
              required
              value={schoolSlug}
              onChange={(e) => setSchoolSlug(e.target.value)}
              placeholder="Your school code"
              autoComplete="organization"
            />
            <label htmlFor="email">School email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              autoComplete="username"
            />
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="button button-primary login-submit"
            >
              {submitting ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="login-help">
            Need an account? Contact your school administrator.
          </p>
          <section className="demo-picker">
            <h3>Take a look around</h3>
            <p>Explore a demo with synthetic student records.</p>
            <div>
              {[
                ["teacher", "Teacher", BookOpen],
                ["admin", "Admin", Users],
                ["student", "Student", GraduationCap],
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  className="demo-role"
                  disabled={submitting}
                  onClick={() =>
                    signIn({ email: `${id}@demo.edu`, demo: true })
                  }
                >
                  <Icon size={19} strokeWidth={1.6} />
                  <span>{label}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
            <small>Demo changes are not saved. No real student data.</small>
          </section>
        </div>
        <p className="login-bottom">
          Thoughtful support starts with paying attention.
        </p>
      </main>
    </div>
  );
}
