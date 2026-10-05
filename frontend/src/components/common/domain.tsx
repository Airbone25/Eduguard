import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleDashed,
  CircleCheck,
  Eye,
  HeartHandshake,
  Minus,
} from "lucide-react";
import type { SupportLevel, Trend } from "@/types/api";

import { supportLabels } from "@/lib/labels";
export function SupportBadge({ level }: { level: SupportLevel }) {
  const Icon = {
    priority_support: HeartHandshake,
    watch: Eye,
    doing_well: CircleCheck,
    not_assessed: CircleDashed,
  }[level];
  return (
    <span className={`support-badge support-${level}`}>
      <Icon size={13} aria-hidden="true" />
      {supportLabels[level]}
    </span>
  );
}
export function TrendIndicator({ trend }: { trend: Trend }) {
  const Icon = {
    improving: ArrowUpRight,
    declining: ArrowDownRight,
    stable: ArrowRight,
    insufficient_history: Minus,
  }[trend];
  const label = {
    improving: "Improving",
    declining: "Declining",
    stable: "Stable",
    insufficient_history: "More history needed",
  }[trend];
  return (
    <span className={`trend trend-${trend}`}>
      <Icon size={15} aria-hidden="true" />
      {label}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}
export function MetricCard({
  title,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: ReactNode;
  detail: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <h2>{title}</h2>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <p>{detail}</p>
    </article>
  );
}
