import { BookOpen, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export function LoadingSkeleton({
  label = "Loading your workspace",
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="loading-block">
      <span className="sr-only">{label}</span>
      <div className="skeleton skeleton-heading" />
      <div className="metric-grid">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="skeleton skeleton-card" />
        ))}
      </div>
      <div className="skeleton skeleton-table" />
    </div>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="state-icon">
        <BookOpen size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div role="alert" className="error-state">
      <CircleAlert size={24} />
      <div>
        <h3>We couldn’t load this information</h3>
        <p>{error.message}</p>
      </div>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
