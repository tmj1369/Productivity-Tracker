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
