import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context";
import { roleHome } from "@/lib/utils";
import { ErrorState, LoadingSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types/api";
export function ProtectedRoute() {
  const auth = useAuth();
  if (auth.pending)
    return (
      <div className="session-screen">
        <LoadingSkeleton label="Restoring your session" />
      </div>
    );
  if (auth.error)
    return (
      <div className="session-screen">
        <ErrorState error={auth.error} retry={auth.retry} />
        <Button
          variant="ghost"
          onClick={() => {
            void auth.signOut().catch(() => undefined);
          }}
        >
          Return to sign in
        </Button>
      </div>
    );
  return auth.user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function RoleRoute({ role }: { role: Role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === role ? (
    <Outlet />
  ) : (
    <Navigate to={roleHome[user.role]} replace />
  );
}
export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome[user.role] : "/login"} replace />;
}
