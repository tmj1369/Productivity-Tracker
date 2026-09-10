export type TrackerStatus = 'IDLE' | 'WORK' | 'BREAK';

export interface TrackerState {
  status: TrackerStatus;
  workElapsedMs: number;
  breakElapsedMs: number;
  activeStartTimestamp: number | null;
  lastUpdatedTimestamp: number;
  soundEnabled: boolean;
  history: SessionInterval[];
}

export interface SessionInterval {
  id: string;
  type: 'WORK' | 'BREAK';
  startTime: number;
  endTime: number;
  durationMs: number;
}

export interface DaySummary {
  dateKey: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "Today, Mar 9", "Yesterday"
  totalWorkMs: number;
  totalBreakMs: number;
  totalMs: number;
  productivityScore: number; // 0-100%
  breakCount: number;
  longestBreakMs: number;
  avgBreakMs: number;
  workSessionCount: number;
  avgWorkSessionMs: number;
  sessions: SessionInterval[];
}

export interface WeekDayPoint {
  dayName: string; // "Mon", "Tue", etc.
  dayLetter: string; // "M", "T", "W", etc.
  shortDate: string; // "Sep 7"
  dateKey: string; // "2026-09-07"
  totalWorkMs: number;
  totalBreakMs: number;
  totalMs: number;
  productivityScore: number;
  breakCount: number;
  longestBreakMs: number;
  isToday: boolean;
  hasData: boolean;
}

export interface WeekSummary {
  weekKey: string; // e.g. "2026-W37"
  weekLabel: string; // e.g. "This Week", "Last Week"
  dateRangeLabel: string; // e.g. "Sep 7 – 13"
  days: WeekDayPoint[];
  totalWorkMs: number;
  totalBreakMs: number;
  totalMs: number;
  productivityScore: number;
  totalBreaks: number;
  longestBreakMs: number;
  avgDailyWorkMs: number;
  activeDaysCount: number;
  bestDay?: { dayName: string; workMs: number; dateKey: string };
}
