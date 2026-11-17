import type { Course, StudentProgress, SupportLevel } from "./api";
export type AlertKind =
  | "declining"
  | "needs_support"
  | "new_data"
  | "improving";
export interface Alert {
  student_id: string;
  name: string;
  roll_number: string;
  course_offering_id: string;
  course: Course;
  course_label: string;
  prediction_id: string;
  as_of_date: string;
  risk_probability: number;
  previous_probability: number | null;
  probability_delta: number | null;
  risk_level: "low" | "medium" | "high";
  at_risk: boolean;
  support_level: Exclude<SupportLevel, "not_assessed">;
  top_signals: {
    code: string;
    factor: string;
    direction: string;
    severity: number;
    message: string;
  }[];
  recommendation_name: string | null;
  active_intervention: boolean;
  kind: AlertKind;
}
export interface AlertFeed {
  as_of_date: string;
  counts: Record<AlertKind | "total", number>;
  alerts: Alert[];
  limit: number;
  offset: number;
}
export interface FeatureContribution {
  name: string;
  value: number | null;
  contribution: number;
}
export interface WhatIfResult {
  prediction_id: string;
  baseline_probability: number;
  baseline_support_level: Exclude<SupportLevel, "not_assessed">;
  probability: number;
  support_level: Exclude<SupportLevel, "not_assessed">;
  delta: number;
  applied_overrides: Record<string, number>;
}
export interface ForecastPoint {
  week_start: string;
  horizon: number;
  risk_probability: number;
  band_low: number;
  band_high: number;
}
export interface ForecastResponse {
  student_id: string;
  course_offering_id: string;
  as_of_date: string;
  history_weeks: number;
  horizon_weeks: number;
  band_level: number;
  model_version: string;
  method: string;
  points: ForecastPoint[];
}
export interface Prediction {
  id: string;
  student_id: string;
  course_offering_id: string;
  as_of_date: string;
  created_at: string;
  model_version_id: string;
  model_version: string;
  feature_snapshot_id: string;
  feature_version: string;
  risk_probability: number;
  risk_level: "low" | "medium" | "high";
  at_risk: boolean;
  support_level: Exclude<SupportLevel, "not_assessed">;
  signals: {
    code: string;
    factor: string;
    direction: string;
    severity: number;
    message: string;
  }[];
  recommendations: {
    template_id: string;
    name: string;
    match_score: number;
    reason: string;
  }[];
  contributions: FeatureContribution[];
}
export type InterventionStatus =
  "planned" | "active" | "completed" | "cancelled";
export interface Goals {
  attendance_target?: number | null;
  assessment_avg_score_target?: number | null;
}
export interface VisibleIntervention {
  id: string;
  course_offering_id: string;
  title: string;
  status: InterventionStatus;
  start_date: string;
  review_date: string | null;
  completed_at: string | null;
  goal_definition: Goals;
}
export interface Intervention extends VisibleIntervention {
  frequency: string | null;
  school_id: string;
  student_id: string;
  template_id: string | null;
  prediction_id: string | null;
  visibility_to_student: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
export interface StudentDashboard extends StudentProgress {
  visible_interventions: VisibleIntervention[];
  interventions_has_more: boolean;
  goals: {
    intervention_id: string;
    course_offering_id: string;
    title: string;
    targets: Goals;
  }[];
}
