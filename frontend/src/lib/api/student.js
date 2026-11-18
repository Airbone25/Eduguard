import { api } from "./client";
import { allPages } from "./pagination";

export const studentApi = {
  dashboard: (signal) => api("/student/me/dashboard", { signal }),
  progress: (weeks, signal, asOf) =>
    api(
      `/student/me/progress?history_weeks=${weeks}${asOf ? `&as_of_date=${encodeURIComponent(asOf)}` : ""}`,
      { signal },
    ),
  support: (signal) => allPages("/student/me/interventions", signal),
};
