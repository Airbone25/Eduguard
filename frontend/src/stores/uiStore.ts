import { create } from "zustand";
import type { SupportLevel, Trend, SummarySort } from "@/types/api";
export interface Filters {
  support: SupportLevel | "all";
  trend: Trend | "all";
  intervention: "all" | "active" | "none";
  search: string;
}
const defaults: Filters = {
  support: "all",
  trend: "all",
  intervention: "all",
  search: "",
};
interface UiState {
  sidebarOpen: boolean;
  courseId: string;
  filters: Filters;
  sort: SummarySort;
  setSidebarOpen: (open: boolean) => void;
  setCourse: (id: string) => void;
  setFilters: (filters: Partial<Filters>) => void;
  setSort: (sort: SummarySort) => void;
  reset: () => void;
}
export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  courseId: "",
  filters: defaults,
  sort: "attention",
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCourse: (courseId) => set({ courseId, filters: defaults }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  setSort: (sort) => set({ sort }),
  reset: () =>
    set({
      sidebarOpen: false,
      courseId: "",
      filters: defaults,
      sort: "attention",
    }),
}));
