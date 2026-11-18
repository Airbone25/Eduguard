import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileSpreadsheet,
  RefreshCw,
  HeartHandshake,
} from "lucide-react";
import { teacherApi } from "@/lib/api/teacher";
import { api } from "@/lib/api/client";
import { useAuth } from "@/features/auth/context";
import { PageHeader, MetricCard } from "@/components/common/domain";
import {
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/common/states";
import { AlertFeed } from "@/features/alerts/AlertFeed";
import { AttentionTable } from "@/features/students/AttentionTable";
import { courseLabel, dateLabel } from "@/lib/utils";
export default function Dashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [alertsError, setAlertsError] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const request = useRef(0);
  const loadData = async (courseId) => {
    const id = ++request.current;
    setError(null);
    try {
      const cls = await teacherApi.classes();
      if (id !== request.current) return;
      setClasses(cls || []);
      const activeId = courseId || selectedCourseId || cls?.[0]?.id || "";
      setSelectedCourseId(activeId);
      const [a, s] = await Promise.allSettled([
        api("/teacher/alerts"),
        activeId ? teacherApi.summary(activeId) : Promise.resolve(null),
      ]);
      if (id !== request.current) return;
      setAlerts(a.status === "fulfilled" ? a.value : null);
      setAlertsError(a.status === "rejected" ? a.reason : null);
      setSummary(s.status === "fulfilled" ? s.value : null);
      setSummaryError(s.status === "rejected" ? s.reason : null);
    } catch (err) {
      if (id === request.current) setError(err);
    } finally {
      if (id === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };
  useEffect(() => {
    loadData();
    return () => {
      request.current++;
    };
  }, []);
  const refresh = () => {
    setRefreshing(true);
    loadData(selectedCourseId);
  };
  if (loading)
    return (
      <LoadingSkeleton label="Getting your classes and student signals…" />
    );
  if (error) return <ErrorState error={error} retry={refresh} />;
  const selectedCourse = classes.find((c) => c.id === selectedCourseId);
  const counts = summary?.counts || {};
  return (
    <div className="dashboard-page">
      <PageHeader
        title={`A closer look, ${user?.first_name || "teacher"}.`}
        description="Small changes tell a story. Here’s where your attention can help."
      >
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="button button-secondary"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        {selectedCourse && (
          <Link
            to={`/teacher/classes/${selectedCourse.id}/weekly`}
            className="button button-primary"
          >
            <FileSpreadsheet size={17} />
            Record this week
          </Link>
        )}
      </PageHeader>
      <div className="overview-grid">
        <div>
          {alertsError ? (
            <ErrorState
              title="Student signals are unavailable"
              error={alertsError}
              retry={refresh}
            />
          ) : (
            <AlertFeed data={alerts} />
          )}
        </div>
        <aside className="overview-aside">
          <section className="weekly-note">
            <CalendarDays size={24} strokeWidth={1.5} />
            <h2>
              Make time for
              <br />a check-in.
            </h2>
            <p>
              A signal is a starting point. A conversation helps you understand
              what the numbers can’t.
            </p>
            <Link to="/teacher/interventions" className="text-link">
              Open support plans <ArrowRight size={16} />
            </Link>
          </section>
          <section className="class-directory">
            <div className="section-heading">
              <h2>Your classes</h2>
              <span>{classes.length}</span>
            </div>
            {classes.map((c) => (
              <Link key={c.id} to={`/teacher/classes/${c.id}`}>
                <BookOpen size={17} />
                <span>
                  <strong>{c.subject_name}</strong>
                  <small>
                    {c.classroom_name} · {c.academic_year}
                  </small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
            {!classes.length && (
              <p>Your administrator will assign your classes here.</p>
            )}
          </section>
          <p className="quiet-note">
            <HeartHandshake size={18} />
            Support begins with understanding, not a score.
          </p>
        </aside>
      </div>
      <section className="class-section" aria-labelledby="class-heading">
        <div className="section-heading class-heading">
          <div>
            <h2 id="class-heading">The class picture</h2>
            <p>Weekly observations and ongoing support, together.</p>
          </div>
          {selectedCourse && (
            <Link
              className="text-link"
              to={`/teacher/classes/${selectedCourse.id}`}
            >
              Class analytics <ArrowRight size={15} />
            </Link>
          )}
        </div>
        {classes.length ? (
          <>
            <div className="course-context">
              <div>
                <label htmlFor="course-select">Choose a class</label>
                <select
                  id="course-select"
                  value={selectedCourseId}
                  disabled={refreshing}
                  onChange={(e) => {
                    setRefreshing(true);
                    loadData(e.target.value);
                  }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {courseLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <span>Latest observation · {dateLabel(summary?.as_of_date)}</span>
            </div>
            {summaryError ? (
              <ErrorState error={summaryError} retry={refresh} />
            ) : (
              <div aria-busy={refreshing}>
                <div className="metric-strip">
                  <MetricCard
                    title="Students"
                    value={counts.students}
                    detail="Enrolled in this class"
                  />
                  <MetricCard
                    title="Priority support"
                    value={counts.priority_support}
                    detail="Review together"
                    tone="critical"
                  />
                  <MetricCard
                    title="On watch"
                    value={counts.watch}
                    detail="Keep an eye on progress"
                    tone="warning"
                  />
                  <MetricCard
                    title="Doing well"
                    value={counts.doing_well}
                    detail="Continue encouragement"
                    tone="success"
                  />
                  <MetricCard
                    title="Active plans"
                    value={
                      summary?.students?.filter((s) => s.active_intervention)
                        .length
                    }
                    detail="Support in progress"
                  />
                </div>
                <AttentionTable
                  courseId={selectedCourseId}
                  students={summary?.students || []}
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="Your classes will appear here"
            description="Ask your school administrator to assign your course offerings. Then you can record observations and review student progress."
          />
        )}
      </section>
    </div>
  );
}
