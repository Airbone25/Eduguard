import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AlertFeed } from "@/types/support";

export function useAlerts() {
  return useQuery({
    queryKey: ["teacher", "alerts"],
    queryFn: ({ signal }) =>
      api<AlertFeed>("/teacher/alerts?limit=200", { signal }),
  });
}
