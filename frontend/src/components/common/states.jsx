import { AlertCircle, BookOpen, RefreshCw } from "lucide-react";
export function LoadingSkeleton({ label = "Loading your workspace…" }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-label">
        <RefreshCw size={17} className="animate-spin" />
        {label}
      </div>
      <div className="skeleton-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
  title = "We couldn’t load these records",
}) {
  return (
    <div role="alert" className="error-state">
      <AlertCircle size={22} />
      <div>
        <h3>{title}</h3>
        <p>
          {error?.message || "The request did not complete. Please try again."}
        </p>
        {retry && (
          <button
            type="button"
            onClick={retry}
            className="button button-secondary"
          >
            <RefreshCw size={15} />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description = "Records will appear here when they are added.",
  children,
}) {
  return (
    <div className="empty-state">
      <BookOpen size={25} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children && <div className="empty-action">{children}</div>}
    </div>
  );
}
