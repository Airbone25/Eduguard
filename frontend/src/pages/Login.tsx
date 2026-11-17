import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  HeartHandshake,
  TrendingUp,
} from "lucide-react";
import { Brand } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/context";
import { roleHome } from "@/lib/utils";
import { ErrorState, LoadingSkeleton } from "@/components/common/states";

const schema = z.object({
  school_slug: z
    .string()
    .trim()
    .min(1, "Enter your school code.")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens."),
  email: z.email("Enter a valid email address.").trim(),
  password: z.string().min(1, "Enter your password.").max(1024),
});
export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [serverError, setServerError] = useState("");
  const logoutWarning = auth.logoutWarning;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { school_slug: "", email: "", password: "" },
  });
  if (auth.pending)
    return (
      <div className="session-screen">
        <LoadingSkeleton label="Restoring your session" />
      </div>
    );
  if (auth.user) return <Navigate to={roleHome[auth.user.role]} replace />;
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <h1>
            See the signal.
            <br />
            Know the reason.
          </h1>
          <p>
            EduGuard turns weekly observations into explained risk trajectories,
            then leaves the decision where it belongs — with you.
          </p>
          <div className="story-steps">
            <div>
              <BookOpen />
              <span>Raw records in, no manual features</span>
            </div>
            <div>
              <TrendingUp />
              <span>Exact contributions behind every signal</span>
            </div>
            <div>
              <HeartHandshake />
              <span>Teacher-only, never shown to students</span>
            </div>
          </div>
        </div>
        <p className="story-footer">
          Advisory by design. Governed by evidence.
        </p>
      </section>
      <main className="auth-main">
        <div className="login-card">
          <h2>Welcome back</h2>
          <p className="login-intro">Sign in to your EduGuard workspace.</p>
          {logoutWarning && (
            <p role="status" className="form-error">
              {logoutWarning}
            </p>
          )}
          {auth.error && <ErrorState error={auth.error} retry={auth.retry} />}
          <form
            noValidate
            onSubmit={handleSubmit(async (input) => {
              setServerError("");
              try {
                const user = await auth.signIn(input);
                navigate(roleHome[user.role], { replace: true });
              } catch (error) {
                setServerError(
                  error instanceof Error
                    ? error.message
                    : "Sign in failed. Please try again.",
                );
              }
            })}
          >
            <div className="field">
              <label htmlFor="school">School code</label>
              <input
                id="school"
                autoComplete="organization"
                placeholder="e.g. riverside-school"
                {...register("school_slug")}
                aria-invalid={Boolean(errors.school_slug)}
                aria-describedby={
                  errors.school_slug ? "school-error" : "school-hint"
                }
              />
              {errors.school_slug ? (
                <p id="school-error" className="field-error">
                  {errors.school_slug.message}
                </p>
              ) : (
                <p id="school-hint" className="field-hint">
                  Use the code provided by your school.
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@school.edu"
                {...register("email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="field-error">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  id="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
              {errors.password && (
                <p id="password-error" className="field-error">
                  {errors.password.message}
                </p>
              )}
            </div>
            {serverError && (
              <p role="alert" className="form-error">
                {serverError}
              </p>
            )}
            <Button
              className="login-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in to EduGuard"}
              <ArrowRight size={18} />
            </Button>
          </form>
          <p className="login-help">
            Need access or help signing in?
            <br />
            <strong>Contact your school administrator.</strong>
          </p>
        </div>
        <p className="auth-footer">Insights inform. Teachers decide.</p>
      </main>
    </div>
  );
}
