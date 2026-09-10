import { SessionInterval, DaySummary } from '../types';

export function formatDateKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFriendlyDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const todayKey = formatDateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  if (dateKey === todayKey) {
    return 'Today';
  }
  if (dateKey === yesterdayKey) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDurationDetailed(millis: number): string {
  if (millis <= 0) return '0m';
  const totalSeconds = Math.floor(millis / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

export function formatClockTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Creates seed history for past 3 days so the user has an immediate, rich
 * experience when inspecting previous daily statistics.
 */
export function generateSeedHistory(): SessionInterval[] {
  const intervals: SessionInterval[] = [];
  const now = new Date();

  // Generate for 3 previous days
  for (let daysAgo = 3; daysAgo >= 1; daysAgo--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - daysAgo);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();

    // Pattern for each day:
    // Session 1: 09:15 - 10:20 (65m Work)
    // Break 1:   10:20 - 10:32 (12m Break)
    // Session 2: 10:32 - 11:45 (73m Work)
    // Break 2 (Lunch/Longest): 11:45 - 12:25 (40m Break)
    // Session 3: 12:25 - 14:00 (95m Work)
    // Break 3:   14:00 - 14:15 (15m Break)
    // Session 4: 14:15 - 15:30 (75m Work)
    // Break 4:   15:30 - 15:40 (10m Break)
    // Session 5: 15:40 - 17:00 (80m Work)
    const schedule = [
      { type: 'WORK' as const, startH: 9, startM: 15, durationMins: 60 + (daysAgo * 5) },
      { type: 'BREAK' as const, startH: 10, startM: 20, durationMins: 12 },
      { type: 'WORK' as const, startH: 10, startM: 35, durationMins: 70 },
      { type: 'BREAK' as const, startH: 11, startM: 45, durationMins: 35 + (daysAgo * 5) }, // Longest break
      { type: 'WORK' as const, startH: 12, startM: 25, durationMins: 90 - (daysAgo * 5) },
      { type: 'BREAK' as const, startH: 14, startM: 0, durationMins: 15 },
      { type: 'WORK' as const, startH: 14, startM: 15, durationMins: 75 },
      { type: 'BREAK' as const, startH: 15, startM: 30, durationMins: 10 },
      { type: 'WORK' as const, startH: 15, startM: 45, durationMins: 65 },
    ];

    schedule.forEach((item, index) => {
      const startTime = new Date(year, month, day, item.startH, item.startM, 0).getTime();
      const durationMs = item.durationMins * 60 * 1000;
      const endTime = startTime + durationMs;

      intervals.push({
        id: `seed_${daysAgo}_${index}`,
        type: item.type,
        startTime,
        endTime,
        durationMs,
      });
    });
  }

  return intervals;
}

/**
 * Aggregates all intervals (including any active in-progress interval) into daily summaries.
 */
export function aggregateDaySummaries(
  history: SessionInterval[],
  activeInterval?: SessionInterval | null
): DaySummary[] {
  const allIntervals = [...history];
  if (activeInterval && activeInterval.durationMs > 0) {
    allIntervals.push(activeInterval);
  }

  const map = new Map<string, SessionInterval[]>();

  for (const interval of allIntervals) {
    const key = formatDateKey(interval.startTime);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(interval);
  }

  // Ensure today's date key exists even if no intervals yet
  const todayKey = formatDateKey(new Date());
  if (!map.has(todayKey)) {
    map.set(todayKey, []);
  }

  const summaries: DaySummary[] = [];

  for (const [dateKey, intervals] of map.entries()) {
    let totalWorkMs = 0;
    let totalBreakMs = 0;
    let longestBreakMs = 0;
    const breaks: SessionInterval[] = [];
    const works: SessionInterval[] = [];

    for (const item of intervals) {
      if (item.type === 'WORK') {
        totalWorkMs += item.durationMs;
        works.push(item);
      } else if (item.type === 'BREAK') {
        totalBreakMs += item.durationMs;
        breaks.push(item);
        if (item.durationMs > longestBreakMs) {
          longestBreakMs = item.durationMs;
        }
      }
    }

    const totalMs = totalWorkMs + totalBreakMs;
    const productivityScore = totalMs > 0 ? Math.round((totalWorkMs / totalMs) * 100) : 0;
    const breakCount = breaks.length;
    const avgBreakMs = breakCount > 0 ? Math.round(totalBreakMs / breakCount) : 0;
    const workSessionCount = works.length;
    const avgWorkSessionMs = workSessionCount > 0 ? Math.round(totalWorkMs / workSessionCount) : 0;

    summaries.push({
      dateKey,
      dateLabel: formatFriendlyDate(dateKey),
      totalWorkMs,
      totalBreakMs,
      totalMs,
      productivityScore,
      breakCount,
      longestBreakMs,
      avgBreakMs,
      workSessionCount,
      avgWorkSessionMs,
      // Sort newest first
      sessions: [...intervals].sort((a, b) => b.startTime - a.startTime),
    });
  }

  // Sort dates newest to oldest
  summaries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return summaries;
}
