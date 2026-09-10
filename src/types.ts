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
