import type { QueryResultRow } from 'pg'

export interface IdRow {
  id: number;
}

export interface CountRow {
  count: number;
}

export interface ExistsRow {
  exists: boolean;
}

export interface WelcomeRow {
  welcome_sent: boolean;
}

export interface Course extends QueryResultRow {
  course_id: string;
  course_name: string;
  course_title: string;
  subject_id: number;
  total_enrolled: number;
  total_capacity: number;
  total_open_seats: number;
  total_waitlist_capacity: number;
  total_waitlist_open: number;
  has_subsections: boolean;
  breadths: string[];
}
