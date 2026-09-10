import { SessionInterval, DaySummary, WeekSummary, WeekDayPoint } from '../types';

export function formatDateKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDDMMYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
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

  return formatDDMMYY(date);
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

export function formatDurationShort(millis: number): string {
  if (millis <= 0) return '0m';
  const totalMinutes = Math.floor(millis / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export function formatClockTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Creates seed history for past 6 days so the user has an immediate, rich
 * experience when inspecting both daily and weekly statistics.
 */
export function generateSeedHistory(): SessionInterval[] {
  const intervals: SessionInterval[] = [];
  const now = new Date();

  // Generate for 6 previous days
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - daysAgo);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();

    // Variable schedule per day to look natural
    const schedule = [
      { type: 'WORK' as const, startH: 9, startM: 15, durationMins: 55 + (daysAgo * 4) },
      { type: 'BREAK' as const, startH: 10, startM: 20, durationMins: 10 + (daysAgo % 3) * 2 },
      { type: 'WORK' as const, startH: 10, startM: 35, durationMins: 65 + (daysAgo % 2) * 10 },
      { type: 'BREAK' as const, startH: 11, startM: 50, durationMins: 30 + (daysAgo * 3) }, // Longest break (lunch)
      { type: 'WORK' as const, startH: 12, startM: 30, durationMins: 80 - (daysAgo * 3) },
      { type: 'BREAK' as const, startH: 14, startM: 0, durationMins: 15 },
      { type: 'WORK' as const, startH: 14, startM: 20, durationMins: 70 },
      { type: 'BREAK' as const, startH: 15, startM: 35, durationMins: 10 },
      { type: 'WORK' as const, startH: 15, startM: 50, durationMins: 60 },
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

/**
 * Gets the Monday of the week for a given date (00:00:00).
 */
export function getMonday(d: Date | string | number): Date {
  const date = typeof d === 'string' ? new Date(d.replace(/-/g, '/')) : new Date(d);
  const day = date.getDay();
  // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.getFullYear(), date.getMonth(), diff, 0, 0, 0, 0);
  return mon;
}

/**
 * Aggregates day summaries into weekly buckets (Monday through Sunday).
 */
export function aggregateWeekSummaries(daySummaries: DaySummary[]): WeekSummary[] {
  const dayMap = new Map<string, DaySummary>();
  for (const ds of daySummaries) {
    dayMap.set(ds.dateKey, ds);
  }

  // Find all distinct Mondays, ensuring current week's Monday is present
  const today = new Date();
  const todayKey = formatDateKey(today);
  const currentMonday = getMonday(today);

  const mondayTimes = new Set<number>();
  mondayTimes.add(currentMonday.getTime());

  for (const ds of daySummaries) {
    const mon = getMonday(ds.dateKey);
    mondayTimes.add(mon.getTime());
  }

  const sortedMondayTimes = Array.from(mondayTimes).sort((a, b) => b - a);
  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const weekSummaries: WeekSummary[] = [];

  for (const monTime of sortedMondayTimes) {
    const mondayDate = new Date(monTime);
    const sundayDate = new Date(monTime);
    sundayDate.setDate(sundayDate.getDate() + 6);

    const weekDays: WeekDayPoint[] = [];
    let totalWorkMs = 0;
    let totalBreakMs = 0;
    let totalBreaks = 0;
    let longestBreakMs = 0;
    let activeDaysCount = 0;
    let bestDay: { dayName: string; workMs: number; dateKey: string } | undefined;

    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(d.getDate() + i);
      const dKey = formatDateKey(d);
      const isToday = dKey === todayKey;
      const shortDate = formatDDMMYY(d);

      const existingDay = dayMap.get(dKey);
      if (existingDay && existingDay.totalMs > 0) {
        totalWorkMs += existingDay.totalWorkMs;
        totalBreakMs += existingDay.totalBreakMs;
        totalBreaks += existingDay.breakCount;
        if (existingDay.longestBreakMs > longestBreakMs) {
          longestBreakMs = existingDay.longestBreakMs;
        }
        activeDaysCount++;

        if (!bestDay || existingDay.totalWorkMs > bestDay.workMs) {
          bestDay = {
            dayName: dayNames[i],
            workMs: existingDay.totalWorkMs,
            dateKey: dKey,
          };
        }

        weekDays.push({
          dayName: dayNames[i],
          dayLetter: dayLetters[i],
          shortDate,
          dateKey: dKey,
          totalWorkMs: existingDay.totalWorkMs,
          totalBreakMs: existingDay.totalBreakMs,
          totalMs: existingDay.totalMs,
          productivityScore: existingDay.productivityScore,
          breakCount: existingDay.breakCount,
          longestBreakMs: existingDay.longestBreakMs,
          isToday,
          hasData: true,
        });
      } else {
        weekDays.push({
          dayName: dayNames[i],
          dayLetter: dayLetters[i],
          shortDate,
          dateKey: dKey,
          totalWorkMs: 0,
          totalBreakMs: 0,
          totalMs: 0,
          productivityScore: 0,
          breakCount: 0,
          longestBreakMs: 0,
          isToday,
          hasData: false,
        });
      }
    }

    const totalMs = totalWorkMs + totalBreakMs;
    const productivityScore = totalMs > 0 ? Math.round((totalWorkMs / totalMs) * 100) : 0;
    const avgDailyWorkMs = activeDaysCount > 0 ? Math.round(totalWorkMs / activeDaysCount) : 0;

    // Determine week label
    const isCurrentWeek = monTime === currentMonday.getTime();
    const lastWeekMonday = new Date(currentMonday);
    lastWeekMonday.setDate(lastWeekMonday.getDate() - 7);
    const isLastWeek = monTime === lastWeekMonday.getTime();

    let weekLabel = 'Week of ' + formatDDMMYY(mondayDate);
    if (isCurrentWeek) {
      weekLabel = 'This Week';
    } else if (isLastWeek) {
      weekLabel = 'Last Week';
    }

    const startStr = formatDDMMYY(mondayDate);
    const endStr = formatDDMMYY(sundayDate);
    const dateRangeLabel = `${startStr} – ${endStr}`;

    weekSummaries.push({
      weekKey: formatDateKey(mondayDate),
      weekLabel,
      dateRangeLabel,
      days: weekDays,
      totalWorkMs,
      totalBreakMs,
      totalMs,
      productivityScore,
      totalBreaks,
      longestBreakMs,
      avgDailyWorkMs,
      activeDaysCount,
      bestDay,
    });
  }

  return weekSummaries;
}

