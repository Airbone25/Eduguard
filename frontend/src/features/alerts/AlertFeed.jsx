import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Check,
  TrendingUp,
  TrendingDown,
  HeartHandshake,
  FileText,
} from "lucide-react";
import { dateLabel } from "@/lib/utils";
import { EmptyState } from "@/components/common/states";
const kinds = {
  declining: { label: "Check in", icon: TrendingDown, tone: "critical" },
  needs_support: {
    label: "Plan support",
    icon: HeartHandshake,
    tone: "warning",
  },
  improving: { label: "Improving", icon: TrendingUp, tone: "success" },
  new_data: { label: "New observations", icon: FileText, tone: "neutral" },
};
const pct = (value) => (value == null ? "—" : `${Math.round(value * 100)}%`);
export function AlertFeed({ data }) {
  const [filter, setFilter] = useState("all");
  const alerts = data?.alerts || [];
  const visible = alerts.filter((a) => filter === "all" || a.kind === filter);
  return (
    <section className="signal-panel" aria-labelledby="signal-heading">
      <div className="section-heading">
        <div>
          <h2 id="signal-heading">
            Students to check in with{" "}
            <span className="count-label">{alerts.length}</span>
          </h2>
          <p>
            Across your classes · observations through{" "}
            {dateLabel(data?.as_of_date)}
          </p>
        </div>
      </div>
      <div
        className="filter-tabs"
        role="group"
        aria-label="Filter student signals"
      >
        {[
          ["all", "All signals"],
          ["declining", "Check in"],
          ["needs_support", "Plan support"],
          ["improving", "Improving"],
          ["new_data", "New data"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
            <span>
              {id === "all"
                ? alerts.length
                : alerts.filter((a) => a.kind === id).length}
            </span>
          </button>
        ))}
      </div>
      <div className="signal-list">
        {visible.map((alert, index) => {
          const meta = kinds[alert.kind] || kinds.new_data;
          const Icon = meta.icon;
          const url = `/teacher/students/${encodeURIComponent(alert.student_id)}?course=${encodeURIComponent(alert.course_offering_id)}`;
          return (
            <article
              className="signal-row"
              key={`${alert.prediction_id}-${alert.kind}-${index}`}
            >
              <div className="signal-person">
                <span className={`student-avatar tone-${meta.tone}`}>
                  {alert.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div>
                  <Link to={url} className="student-name">
                    {alert.name}
                  </Link>
                  <p>
                    {alert.course_label} · {alert.roll_number}
                  </p>
                </div>
                <span className={`status-label tone-${meta.tone}`}>
                  <Icon size={14} />
                  {meta.label}
                </span>
              </div>
              <p className="signal-observation">
                {alert.top_signals?.[0]?.message ||
                  "New observations are ready for your review."}
              </p>
              <div className="signal-actions">
                <details className="evidence-disclosure">
                  <summary>
                    View evidence <ChevronDown size={15} />
                  </summary>
                  <div className="evidence-content">
                    <strong>What informed this signal</strong>
                    {alert.top_signals?.length ? (
                      <ul>
                        {alert.top_signals.map((s, i) => (
                          <li key={i}>{s.message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        No contributing factors are available for this
                        observation.
                      </p>
                    )}
                    <p className="risk-comparison">
                      Model estimate:{" "}
                      {alert.previous_probability != null && (
                        <>
                          {pct(alert.previous_probability)}{" "}
                          <ArrowRight size={13} />{" "}
                        </>
                      )}
                      <strong>{pct(alert.risk_probability)}</strong>
                    </p>
                    {alert.recommendation_name && (
                      <p>
                        <strong>Suggested next step:</strong>{" "}
                        {alert.recommendation_name}
                      </p>
                    )}
                    <small>
                      Advisory only. Review the context before taking action.
                    </small>
                  </div>
                </details>
                <Link className="text-link" to={url}>
                  Review student <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <EmptyState
          title={
            alerts.length ? "No signals in this view" : "No check-ins flagged"
          }
          description={
            alerts.length
              ? "Choose another filter to see the rest of your signals."
              : "New signals will appear when weekly observations are assessed."
          }
        >
          {alerts.length > 0 && (
            <button
              className="button button-secondary"
              onClick={() => setFilter("all")}
            >
              Show all signals
            </button>
          )}
        </EmptyState>
      )}
      <div className="signal-footnote">
        <Check size={14} />
        These insights are visible to teachers only.
      </div>
    </section>
  );
}
