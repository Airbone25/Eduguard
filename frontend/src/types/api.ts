export type Role = "school_admin" | "teacher" | "student";
export interface User {
  id: string;
  school_id: string;
  email: string;
  role: Role;
  first_name: string;
  last_name: string;
  is_active: boolean;
  last_login_at: string | null;
}
export interface Tokens {
  access_token: string;
  refresh_token: string;
}
export interface Session extends Tokens {
  token_type: "bearer";
  user: User;
}
export interface LoginInput {
  school_slug: string;
  email: string;
  password: string;
}
export interface Course {
  classroom_name?: string;
  subject_name?: string;
  id: string;
  school_id: string;
  classroom_id: string;
  subject_id: string;
  academic_year: string;
  is_active: boolean;
}
export interface Student {
  id: string;
  school_id: string;
  user_id: string;
  roll_number: string;
  grade_label: string;
  user: User;
}
export type SupportLevel =
  "priority_support" | "watch" | "doing_well" | "not_assessed";
export type Trend =
  "improving" | "stable" | "declining" | "insufficient_history";
export type SummarySort = "attention" | "name" | "attendance" | "score";
export interface DashboardStudent {
  student_id: string;
  name: string;
  roll_number: string;
  support_level: SupportLevel;
  prediction_as_of_date: string | null;
  trajectory: Trend;
  newly_declining: boolean;
  latest_score: number | null;
  attendance: number | null;
  top_signal: string | null;
  active_intervention: boolean;
}
export interface RiskSummary {
  course: Course;
  as_of_date: string;
  counts: Record<SupportLevel | "students" | "newly_declining", number>;
  students: DashboardStudent[];
  limit: number;
  offset: number;
}
export interface ProgressMetric {
  current: number | null;
  change_4wk: number | null;
  trend: Trend;
}
export interface CourseProgress {
  course: {
    id: string;
    classroom_name: string;
    subject_name: string;
    subject_code: string;
    academic_year: string;
  };
  attendance: ProgressMetric;
  academic: ProgressMetric;
  assignments: {
    total: number | null;
    completed: number | null;
    completion_percent: number | null;
    on_time_streak_weeks: number | null;
  };
  improvements: { code: string; value: number }[];
  weeks: {
    week_start: string;
    attendance_percent: number | null;
    assessment_avg_score: number | null;
    assignment_count: number | null;
    assignments_completed: number | null;
    late_submissions: number | null;
  }[];
}
export interface StudentProgress {
  student_id: string;
  as_of_date: string;
  courses: CourseProgress[];
}
