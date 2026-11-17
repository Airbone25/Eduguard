import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownRight,
  BellRing,
  DatabaseZap,
  HeartHandshake,
} from "lucide-react";
import { useAlerts } from "./hooks";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/states";
import { SupportBadge } from "@/components/common/domain";
import { dateLabel } from "@/lib/utils";
import type { Alert, AlertKind } from "@/types/support";

const pct = (value: number) => `${Math.round(value * 100)}%`;

const tabLabel = {
  priority_support: "Priority",
  watch: "Watch",
  doing_well: "Improving",
  not_assessed: "Unfiled",
} as const;

const kindMeta: Record<AlertKind, { label: string; tone: string; icon: ReactNode }> = {
  declining: {
    label: "Risk rising",
    tone: "declining",
    icon: <ArrowUpRight size={14} aria-hidden="true" />,
  },
  needs_support: {
    label: "Needs a support plan",
    tone: "needs_support",
    icon: <HeartHandshake size={14} aria-hidden="true" />,
  },
  new_data: {
    label: "New data since last insight",
    tone: "new_data",
    icon: <DatabaseZap size={14} aria-hidden="true" />,
  },
  improving: {
    label: "Recovering",
    tone: "improving",
    icon: <ArrowDownRight size={14} aria-hidden="true" />,
  },
};

function AlertCard({ alert }: { alert: Alert }) {
  const meta = kindMeta[alert.kind];
  const href = `/teacher/students/${encodeURIComponent(
    alert.student_id,
  )}?course=${encodeURIComponent(alert.course_offering_id)}`;
  return (
    <article className={`alert-card alert-${meta.tone}`}>
      <span className={`card-tab tab-${alert.support_level}`} aria-hidden="true">
        {tabLabel[alert.support_level]}
      </span>
      <div className="alert-head">
        <span className="alert-kind">
          {meta.icon}
          {meta.label}
        </span>
        <SupportBadge level={alert.support_level} />
      </div>
      <h3>
        <Link to={href}>{alert.name}</Link>
      </h3>
      <p className="alert-context">
        {alert.course_label} · <span className="call-number">Roll {alert.roll_number}</span>
      </p>
      <p className="alert-risk">
        {alert.previous_probability === null
          ? `Risk signal ${pct(alert.risk_probability)}`
          : `Risk ${pct(alert.previous_probability)} → ${pct(
              alert.risk_probability,
            )} (${
              alert.probability_delta !== null && alert.probability_delta > 0
                ? "+"
                : ""
            }${Math.round((alert.probability_delta ?? 0) * 100)} pts)`}
      </p>
      <details className="pull-slip">
        <summary>Why this card was pulled</summary>
        <div className="slip-body">
          {alert.top_signals.length ? (
            <ul className="alert-signals">
              {alert.top_signals.map((signal) => (
                <li key={signal.code}>{signal.message}</li>
              ))}
            </ul>
          ) : null}
          {alert.recommendation_name && (
            <p className="alert-recommendation">
              Suggested next step: {alert.recommendation_name}
            </p>
          )}
          <p className="slip-governance">Advisory. You decide.</p>
        </div>
      </details>
      <Link className="button button-outline button-sm" to={href}>
        Review student
      </Link>
    </article>
  );
}

export function AlertFeed() {
  const alerts = useAlerts();
  const [filter, setFilter] = useState<AlertKind | "all">("all");
  if (alerts.isPending)
    return <LoadingSkeleton label="Checking for new signals" />;
  if (alerts.error)
    return (
      <ErrorState
        error={alerts.error}
        retry={() => {
          void alerts.refetch();
        }}
      />
    );
  const data = alerts.data;
  if (data.counts.total === 0) return null;
  const visible =
    filter === "all"
      ? data.alerts
      : data.alerts.filter((a) => a.kind === filter);
  const chips: { value: AlertKind | "all"; label: string }[] = [
    { value: "all", label: "All signals" },
    { value: "declining", label: "Rising risk" },
    { value: "needs_support", label: "Needs a plan" },
    { value: "new_data", label: "New data" },
    { value: "improving", label: "Recovering" },
  ];
  return (
    <section className="panel alert-panel" aria-labelledby="alert-feed-title">
      <div className="section-heading">
        <div>
          <div className="heading-line">
            <h2 id="alert-feed-title">
              <BellRing size={17} aria-hidden="true" /> Signals that need your
              attention
            </h2>
            <span className="count-pill">{data.counts.total}</span>
          </div>
          <p>
            Detected automatically from weekly records and saved insights, as
            of {dateLabel(data.as_of_date)}. Every insight is a starting point —
            the next step is yours.
          </p>
        </div>
      </div>
      <div
        className="filter-chips"
        role="group"
        aria-label="Filter signals by type"
      >
        {chips.map((chip) => {
          const count =
            chip.value === "all" ? data.counts.total : data.counts[chip.value];
          if (chip.value !== "all" && count === 0) return null;
          return (
            <button
              type="button"
              key={chip.value}
              className={filter === chip.value ? "chip active" : "chip"}
              aria-pressed={filter === chip.value}
              onClick={() => setFilter(chip.value)}
            >
              {chip.label} <span>{count}</span>
            </button>
          );
        })}
      </div>
      {visible.length ? (
        <div className="alert-grid">
          {visible.map((alert) => (
            <AlertCard key={alert.prediction_id} alert={alert} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No signals of this type"
          description="Switch filters or check again after the next weekly records are saved."
        />
      )}
      <p className="data-note">
        Risk signals are advisory and never shown to students. Use your
        professional judgment.
      </p>
    </section>
  );
}
