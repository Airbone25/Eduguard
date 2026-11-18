import React from "react";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Shield,
} from "lucide-react";
import { supportLabels, trendLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function SupportBadge({ level, showIcon = true, className }) {
  const meta = {
    priority_support: {
      label: supportLabels.priority_support,
      classes:
        "bg-red-50 text-red-800 border-red-200/80 ring-1 ring-red-400/20",
      icon: <ShieldAlert size={12} className="text-red-600" />,
    },
    watch: {
      label: supportLabels.watch,
      classes:
        "bg-amber-50 text-amber-900 border-amber-200/80 ring-1 ring-amber-400/20",
      icon: <Shield size={12} className="text-amber-600" />,
    },
    doing_well: {
      label: supportLabels.doing_well,
      classes:
        "bg-emerald-50 text-emerald-800 border-emerald-200/80 ring-1 ring-emerald-400/20",
      icon: <ShieldCheck size={12} className="text-emerald-600" />,
    },
    not_assessed: {
      label: supportLabels.not_assessed,
      classes:
        "bg-slate-100 text-slate-700 border-slate-200 ring-1 ring-slate-300/20",
      icon: <HelpCircle size={12} className="text-slate-400" />,
    },
  }[level] || {
    label: level || "Unknown",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
    icon: null,
  };

  return (
    <span
      className={cn(
        "support-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border",
        meta.classes,
        className,
      )}
    >
      {showIcon && meta.icon}
      <span>{meta.label}</span>
    </span>
  );
}

export function TrendIndicator({ trend, className }) {
  const meta = {
    declining: {
      label: trendLabels.declining,
      classes: "text-red-700 bg-red-50/70 border-red-200",
      icon: <TrendingDown size={13} />,
    },
    improving: {
      label: trendLabels.improving,
      classes: "text-emerald-700 bg-emerald-50/70 border-emerald-200",
      icon: <TrendingUp size={13} />,
    },
    stable: {
      label: trendLabels.stable,
      classes: "text-slate-600 bg-slate-50 border-slate-200",
      icon: <Minus size={13} />,
    },
    insufficient_history: {
      label: trendLabels.insufficient_history,
      classes: "text-slate-500 bg-slate-50 border-slate-200",
      icon: <HelpCircle size={13} />,
    },
  }[trend] || {
    label: trend || "—",
    classes: "text-slate-500 bg-slate-50 border-slate-200",
    icon: null,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
        meta.classes,
        className,
      )}
      title={`Trajectory: ${meta.label}`}
    >
      {meta.icon}
      <span>{meta.label}</span>
    </span>
  );
}

export function MetricCard({
  title,
  value,
  detail,
  tone = "default",
  className,
}) {
  return (
    <div className={cn(`metric-item metric-${tone}`, className)}>
      <div className="metric-label">
        <span>{title}</span>
      </div>
      <div className="metric-value">{value ?? "—"}</div>
      {detail && <p className="metric-detail">{detail}</p>}
    </div>
  );
}

export function PageHeader({ title, description, children, badge }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title-row">
          <h1>{title}</h1>
          {badge}
        </div>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function GovernanceBanner() {
  return (
    <div className="governance-note">
      <Shield size={14} className="text-amber-700 shrink-0" />
      <span>
        Model insights support your judgment. These signals are never shown to
        students.
      </span>
    </div>
  );
}
