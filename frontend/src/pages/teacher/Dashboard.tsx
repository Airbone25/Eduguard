import { useMemo } from "react";
import {
  BookOpen,
  CheckCheck,
  CircleCheck,
  Eye,
  HeartHandshake,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useAuth } from "@/features/auth/context";
import { useClassSummary, useTeacherClasses } from "@/features/classes/hooks";
import { AttentionTable } from "@/features/students/AttentionTable";
import { useUiStore } from "@/stores/uiStore";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import { MetricCard, PageHeader } from "@/components/common/domain";
import { supportLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { courseLabel, dateLabel } from "@/lib/utils";
import type { SummarySort, Trend } from "@/types/api";

export default function Dashboard() {
  const { user } = useAuth();
  const ui = useUiStore();
  const classes = useTeacherClasses();
  const course =
    classes.data?.find((c) => c.id === ui.courseId) ?? classes.data?.[0];
  const summary = useClassSummary(course?.id ?? "", ui.sort);
  const filtered = useMemo(
    () =>
      summary.data?.students.filter(
        (s) =>
          (ui.filters.support === "all" ||
            s.support_level === ui.filters.support) &&
          (ui.filters.trend === "all" || s.trajectory === ui.filters.trend) &&
          (ui.filters.intervention === "all" ||
            s.active_intervention === (ui.filters.intervention === "active")) &&
          `${s.name} ${s.roll_number}`
            .toLowerCase()
            .includes(ui.filters.search.toLowerCase().trim()),
      ) ?? [],
    [summary.data, ui.filters],
  );
  if (classes.isPending)
    return <LoadingSkeleton label="Loading assigned classes" />;
  if (classes.error)
    return (
      <ErrorState
        error={classes.error}
        retry={() => {
          void classes.refetch();
        }}
      />
    );
  const data = summary.data;
  const active =
    data?.students.filter((s) => s.active_intervention).length ?? 0;
  return (
    <>
      <PageHeader
        eyebrow="Teacher overview"
        title={`Hello, ${user?.first_name ?? "there"}.`}
        description="A little clarity for the students who count on you."
      >
        <Button
          variant="outline"
          disabled={classes.isFetching || summary.isFetching}
          onClick={() => {
            void classes.refetch();
            if (course) void summary.refetch();
          }}
        >
          <RefreshCw size={15} />
          Refresh
        </Button>
      </PageHeader>
      {!course ? (
        <section className="panel">
          <EmptyState
            title="Your classes will appear here"
            description="Once your school assigns you to a course, you’ll be able to follow your students’ progress here."
          />
        </section>
      ) : (
        <>
          <section className="course-toolbar">
            <div className="course-choice">
              <span className="course-icon">
                <BookOpen size={20} />
              </span>
              <div>
                <label htmlFor="course-select">Your class & subject</label>
                <select
                  id="course-select"
                  value={course.id}
                  onChange={(e) => ui.setCourse(e.target.value)}
                >
                  {classes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {courseLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="snapshot-label">
              {data ? (
                <>
                  Snapshot as of <strong>{dateLabel(data.as_of_date)}</strong>
                </>
              ) : (
                "Student support overview"
              )}
            </p>
          </section>
          {summary.isPending ? (
            <LoadingSkeleton label="Loading class support summary" />
          ) : summary.error ? (
            <ErrorState
              error={summary.error}
              retry={() => {
                void summary.refetch();
              }}
            />
          ) : (
            data && (
              <>
                <div className="metric-grid">
                  <MetricCard
                    title="Students"
                    value={data.counts.students}
                    detail="In this course"
                    icon={<Users size={19} />}
                  />
                  <MetricCard
                    title="Priority Support"
                    value={data.counts.priority_support}
                    detail="A closer look can help"
                    tone="priority"
                    icon={<HeartHandshake size={19} />}
                  />
                  <MetricCard
                    title="Watch"
                    value={data.counts.watch}
                    detail="Keep an eye on progress"
                    tone="watch"
                    icon={<Eye size={19} />}
                  />
                  <MetricCard
                    title="Doing Well"
                    value={data.counts.doing_well}
                    detail="Keep the momentum going"
                    tone="positive"
                    icon={<CircleCheck size={19} />}
                  />
                  <MetricCard
                    title="Active Plans"
                    value={active}
                    detail="Students with an open plan"
                    icon={<CheckCheck size={19} />}
                  />
                </div>
                <section className="panel attention-panel">
                  <div className="section-heading">
                    <div>
                      <div className="heading-line">
                        <h2>Your students</h2>
                        <span className="count-pill">
                          {data.counts.students}
                        </span>
                      </div>
                      <p>A starting point for thoughtful, timely support.</p>
                    </div>
                    <label className="sort-field">
                      Sort by
                      <select
                        aria-label="Sort students"
                        value={ui.sort}
                        onChange={(e) =>
                          ui.setSort(e.target.value as SummarySort)
                        }
                      >
                        <option value="attention">Needs attention</option>
                        <option value="name">Student name</option>
                        <option value="attendance">
                          Attendance · lowest first
                        </option>
                        <option value="score">Score · lowest first</option>
                      </select>
                    </label>
                  </div>
                  <div
                    className="filter-chips"
                    role="group"
                    aria-label="Filter by support status"
                  >
                    <button
                      type="button"
                      className={
                        ui.filters.support === "all" ? "chip active" : "chip"
                      }
                      aria-pressed={ui.filters.support === "all"}
                      onClick={() => ui.setFilters({ support: "all" })}
                    >
                      All students <span>{data.counts.students}</span>
                    </button>
                    {(
                      Object.keys(
                        supportLabels,
                      ) as (keyof typeof supportLabels)[]
                    ).map((level) => (
                      <button
                        type="button"
                        key={level}
                        className={
                          ui.filters.support === level ? "chip active" : "chip"
                        }
                        aria-pressed={ui.filters.support === level}
                        onClick={() => ui.setFilters({ support: level })}
                      >
                        {supportLabels[level]} <span>{data.counts[level]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="table-tools">
                    <div className="search-field">
                      <Search size={17} />
                      <input
                        aria-label="Search students"
                        placeholder="Search by name or roll number"
                        value={ui.filters.search}
                        onChange={(e) =>
                          ui.setFilters({ search: e.target.value })
                        }
                      />
                    </div>
                    <select
                      aria-label="Filter by trend"
                      value={ui.filters.trend}
                      onChange={(e) =>
                        ui.setFilters({
                          trend: e.target.value as Trend | "all",
                        })
                      }
                    >
                      <option value="all">All trends</option>
                      <option value="declining">Declining</option>
                      <option value="improving">Improving</option>
                      <option value="stable">Stable</option>
                      <option value="insufficient_history">
                        More history needed
                      </option>
                    </select>
                    <select
                      aria-label="Filter by intervention"
                      value={ui.filters.intervention}
                      onChange={(e) =>
                        ui.setFilters({
                          intervention: e.target.value as
                            "all" | "active" | "none",
                        })
                      }
                    >
                      <option value="all">All interventions</option>
                      <option value="active">With an open plan</option>
                      <option value="none">No open plan</option>
                    </select>
                  </div>
                  {data.counts.students === 0 ? (
                    <EmptyState
                      title="No students enrolled yet"
                      description="Students enrolled in this course will appear here. Your school administrator manages enrollments."
                    />
                  ) : (
                    <AttentionTable
                      key={`${course.id}-${JSON.stringify(ui.filters)}-${ui.sort}`}
                      courseId={course.id}
                      students={filtered}
                    />
                  )}
                </section>
                <div className="dashboard-bottom">
                  <section className="support-note">
                    <span className="note-icon">
                      <HeartHandshake size={23} />
                    </span>
                    <div>
                      <h2>Support is a conversation.</h2>
                      <p>
                        Use these signals alongside what you know about your
                        students. Every insight is a starting point, and the
                        next step is yours.
                      </p>
                    </div>
                  </section>
                  <section className="plan-summary">
                    <CheckCheck size={21} />
                    <div>
                      <h2>
                        {active
                          ? `${active} ${active === 1 ? "student has" : "students have"} support in place`
                          : "Room for a helpful next step"}
                      </h2>
                      <p>
                        {active
                          ? "Open plans include planned and active interventions."
                          : "No students in this course have an open support plan."}
                      </p>
                    </div>
                  </section>
                </div>
                {data.counts.not_assessed > 0 && (
                  <p className="data-note">
                    {data.counts.not_assessed}{" "}
                    {data.counts.not_assessed === 1
                      ? "student is"
                      : "students are"}{" "}
                    not assessed yet. Missing scores and attendance stay blank
                    until data is available.
                  </p>
                )}
              </>
            )
          )}
        </>
      )}
    </>
  );
}
