import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Coffee, 
  Briefcase, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Layers,
  Sparkles,
  Trash2
} from 'lucide-react';
import { DaySummary, WeekSummary } from '../types';
import { 
  formatDurationDetailed, 
  formatDurationShort, 
  formatClockTime, 
  aggregateWeekSummaries,
  formatDDMMYY
} from '../utils/statsHelper';

interface DailyStatsViewProps {
  daySummaries: DaySummary[];
  onBackToTimer: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export const DailyStatsView: React.FC<DailyStatsViewProps> = ({
  daySummaries,
  onBackToTimer,
  onDeleteSession,
}) => {
  const [activeTab, setActiveTab] = useState<'DAY' | 'WEEK'>('DAY');
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  // Compute weeks from day summaries
  const weekSummaries = useMemo(() => aggregateWeekSummaries(daySummaries), [daySummaries]);

  const selectedDay = daySummaries[selectedDateIndex] || daySummaries[0];
  const selectedWeek = weekSummaries[selectedWeekIndex] || weekSummaries[0];

  // Day navigation
  const canGoPrevDay = selectedDateIndex < daySummaries.length - 1;
  const canGoNextDay = selectedDateIndex > 0;

  const handlePrevDay = () => {
    if (canGoPrevDay) setSelectedDateIndex((prev) => prev + 1);
  };

  const handleNextDay = () => {
    if (canGoNextDay) setSelectedDateIndex((prev) => prev - 1);
  };

  // Week navigation
  const canGoPrevWeek = selectedWeekIndex < weekSummaries.length - 1;
  const canGoNextWeek = selectedWeekIndex > 0;

  const handlePrevWeek = () => {
    if (canGoPrevWeek) setSelectedWeekIndex((prev) => prev + 1);
  };

  const handleNextWeek = () => {
    if (canGoNextWeek) setSelectedWeekIndex((prev) => prev - 1);
  };

  // Switch to specific day from weekly breakdown
  const handleSelectDayFromWeek = (dateKey: string) => {
    const idx = daySummaries.findIndex((d) => d.dateKey === dateKey);
    if (idx !== -1) {
      setSelectedDateIndex(idx);
    }
    setActiveTab('DAY');
  };

  // Find longest break session for selected day
  const longestBreakSession = selectedDay?.sessions.find(
    (s) => s.type === 'BREAK' && s.durationMs === selectedDay.longestBreakMs && s.durationMs > 0
  );

  // Week chart scaling: find maximum daily total hours in the selected week
  const maxWeekDayHours = useMemo(() => {
    if (!selectedWeek || !selectedWeek.days) return 8;
    const maxDayTotalMs = Math.max(
      ...selectedWeek.days.map((d) => d.totalMs),
      4 * 3600 * 1000 // minimum 4 hours scale
    );
    return maxDayTotalMs / (3600 * 1000);
  }, [selectedWeek]);

  return (
    <div className="w-full max-w-md bg-[#0E121B] rounded-2xl p-4 sm:p-5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6),0_2px_8px_-2px_rgba(0,0,0,0.4)] border border-[#1A2232] text-[#F1F4FA] transition-all">
      {/* Top Header: Timer Back Button & Day / Week Segmented Switcher */}
      <header className="flex items-center justify-between pb-3.5 border-b border-[#1A2232] mb-3.5">
        <button
          id="btn-back-to-timer"
          type="button"
          onClick={onBackToTimer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8B98AD] hover:text-[#F1F4FA] hover:bg-[#161D2B] transition-colors active:scale-95 cursor-pointer select-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Timer</span>
        </button>

        {/* Day / Week Switcher Tabs */}
        <nav 
          id="insights-tab-nav"
          aria-label="Insights View Mode"
          className="flex items-center bg-[#121622] p-1 rounded-xl border border-[#1C2436]"
        >
          <button
            id="tab-day-analytics"
            type="button"
            role="tab"
            aria-selected={activeTab === 'DAY'}
            onClick={() => setActiveTab('DAY')}
            className={`px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'DAY'
                ? 'bg-[#1D2536] text-[#9AB87A] shadow-xs border border-[#9AB87A]/30'
                : 'text-[#8B98AD] hover:text-[#F1F4FA]'
            }`}
          >
            Day
          </button>
          <button
            id="tab-week-analytics"
            type="button"
            role="tab"
            aria-selected={activeTab === 'WEEK'}
            onClick={() => setActiveTab('WEEK')}
            className={`px-3.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'WEEK'
                ? 'bg-[#1D2536] text-[#9AB87A] shadow-xs border border-[#9AB87A]/30'
                : 'text-[#8B98AD] hover:text-[#F1F4FA]'
            }`}
          >
            Week
          </button>
        </nav>
      </header>

      {/* ========================================================================= */}
      {/* 1. SIMPLIFIED DAILY ANALYTICS TAB                                         */}
      {/* ========================================================================= */}
      {activeTab === 'DAY' && (
        <main id="daily-analytics-content" className="space-y-3 animate-fade-in">
          {/* Streamlined Day Selector */}
          <section 
            id="daily-date-navigator"
            aria-label="Day Selector"
            className="flex items-center justify-between bg-[#121622] rounded-xl px-2 py-1.5 border border-[#1C2436]"
          >
            <button
              id="btn-prev-day"
              type="button"
              onClick={handlePrevDay}
              disabled={!canGoPrevDay}
              aria-label="Previous day"
              className="p-1.5 rounded-lg text-[#8B98AD] hover:text-white hover:bg-[#1C2436] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="text-xs font-semibold text-[#F1F4FA]">
                {selectedDay?.dateLabel}
              </div>
              <div className="text-[10px] text-[#717E94] font-mono">
                {formatDDMMYY(new Date(selectedDay.dateKey))}
              </div>
            </div>

            <button
              id="btn-next-day"
              type="button"
              onClick={handleNextDay}
              disabled={!canGoNextDay}
              aria-label="Next day"
              className="p-1.5 rounded-lg text-[#8B98AD] hover:text-white hover:bg-[#1C2436] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>

          {/* Clean Focus & Balance Summary */}
          <section
            id="card-daily-focus"
            aria-label="Productivity and Time Balance"
            className="bg-[#121622] border border-[#1C2436] rounded-xl p-4"
          >
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                  Productivity
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-mono font-bold text-[#9AB87A] tracking-tight">
                    {selectedDay.productivityScore}%
                  </span>
                  <span className="text-xs text-[#8B98AD]">
                    Focus Score
                  </span>
                </div>
              </div>

              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                selectedDay.productivityScore >= 70
                  ? 'bg-[#9AB87A]/15 text-[#9AB87A] border-[#9AB87A]/30'
                  : selectedDay.productivityScore >= 40
                  ? 'bg-[#E2B068]/15 text-[#E2B068] border-[#E2B068]/30'
                  : 'bg-[#717E94]/15 text-[#8B98AD] border-[#717E94]/30'
              }`}>
                {selectedDay.totalMs === 0
                  ? 'No Data'
                  : selectedDay.productivityScore >= 90
                  ? 'Enough Da'
                  : selectedDay.productivityScore >= 80
                  ? 'What a Worker'
                  : selectedDay.productivityScore >= 70
                  ? 'Flow State'
                  : selectedDay.productivityScore >= 60
                  ? 'Cooking'
                  : selectedDay.productivityScore >= 50
                  ? 'Zen Master'
                  : selectedDay.productivityScore >= 40
                  ? 'Work Da'
                  : selectedDay.productivityScore >= 30
                  ? 'Work Means'
                  : selectedDay.productivityScore >= 20
                  ? 'Work you Bum'
                  : selectedDay.productivityScore >= 10
                  ? 'Procrastinator Max'
                  : 'Couch Potato'}
              </span>
            </div>

            {/* Single Dual Progress Bar */}
            <div className="w-full h-2 bg-[#171E2D] rounded-full overflow-hidden flex mb-3">
              <div 
                className="h-full bg-[#9AB87A] transition-all duration-300"
                style={{ width: `${selectedDay.totalMs > 0 ? selectedDay.productivityScore : 50}%` }}
              />
              <div 
                className="h-full bg-[#E2B068] transition-all duration-300"
                style={{ width: `${selectedDay.totalMs > 0 ? 100 - selectedDay.productivityScore : 50}%` }}
              />
            </div>

            {/* Clear Work, Break & Total Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#1C2436]/60">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#9AB87A]/15 text-[#9AB87A] flex items-center justify-center shrink-0">
                  <Briefcase className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-[#717E94] font-medium truncate">Work Time</div>
                  <div className="text-xs sm:text-sm font-mono font-semibold text-[#9AB87A] truncate">
                    {formatDurationDetailed(selectedDay.totalWorkMs)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E2B068]/15 text-[#E2B068] flex items-center justify-center shrink-0">
                  <Coffee className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-[#717E94] font-medium truncate">Break Time</div>
                  <div className="text-xs sm:text-sm font-mono font-semibold text-[#E2B068] truncate">
                    {formatDurationDetailed(selectedDay.totalBreakMs)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#717E94]/15 text-[#F1F4FA] flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-[#717E94] font-medium truncate">Total Time</div>
                  <div className="text-xs sm:text-sm font-mono font-semibold text-[#F1F4FA] truncate">
                    {formatDurationDetailed(selectedDay.totalMs)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Key Break Metrics: Frequency, Longest Break & Average Break */}
          <section 
            id="card-daily-break-stats"
            aria-label="Break Analysis"
            className="grid grid-cols-3 gap-2"
          >
            {/* Break Frequency */}
            <div className="bg-[#121622] border border-[#1C2436] rounded-xl p-2.5 flex flex-col items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD] text-center">
                Breaks
              </span>
              <div className="font-mono text-lg font-bold text-[#F1F4FA] mt-0.5">
                {selectedDay.breakCount}
              </div>
              <span className="text-[9px] text-[#717E94] text-center mt-0.5">
                sessions
              </span>
            </div>

            {/* Longest Break */}
            <div className="bg-[#121622] border border-[#1C2436] rounded-xl p-2.5 flex flex-col items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD] text-center">
                Longest
              </span>
              <div className="font-mono text-lg font-bold text-[#E2B068] mt-0.5">
                {selectedDay.longestBreakMs > 0 ? formatDurationShort(selectedDay.longestBreakMs) : '0m'}
              </div>
              <span className="text-[9px] text-[#717E94] text-center mt-0.5">
                max pause
              </span>
            </div>

            {/* Average Break Duration */}
            <div className="bg-[#121622] border border-[#1C2436] rounded-xl p-2.5 flex flex-col items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD] text-center">
                Average
              </span>
              <div className="font-mono text-lg font-bold text-[#F1F4FA] mt-0.5">
                {selectedDay.breakCount > 0 ? formatDurationShort(selectedDay.avgBreakMs) : '0m'}
              </div>
              <span className="text-[9px] text-[#717E94] text-center mt-0.5">
                per pause
              </span>
            </div>
          </section>

          {/* Visual Session Timeline */}
          <section 
            id="card-daily-timeline"
            aria-label="Session Timeline"
            className="bg-[#121622] border border-[#1C2436] rounded-xl p-3.5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#8B98AD]" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                  Timeline ({selectedDay.sessions.length} sessions)
                </span>
              </div>
            </div>

            {selectedDay.totalMs === 0 ? (
              <div className="text-center py-5 text-xs text-[#717E94]">
                No sessions logged for this date.
              </div>
            ) : (() => {
              // Calculate day span for chronological timeline
              const dayStart = Math.min(...selectedDay.sessions.map(s => s.startTime));
              const dayEnd = Math.max(...selectedDay.sessions.map(s => s.endTime));
              const daySpan = dayEnd - dayStart;

              return (
                <div className="space-y-3">
                  {/* Chronological Timeline Bar */}
                  <div className="relative w-full h-4 rounded-md overflow-hidden bg-[#171E2D] shadow-inner">
                    {selectedDay.sessions.map((session, index) => {
                      const left = ((session.startTime - dayStart) / daySpan) * 100;
                      const width = (session.durationMs / daySpan) * 100;
                      return (
                        <div
                          key={session.id || index}
                          className={`absolute h-full ${session.type === 'WORK' ? 'bg-[#9AB87A]' : 'bg-[#E2B068]'}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${session.type === 'WORK' ? 'Work' : 'Break'}: ${formatDurationShort(session.durationMs)}`}
                        />
                      );
                    })}
                  </div>

                  {/* Total Session Duration Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full overflow-hidden bg-[#171E2D]">
                      <div 
                        className="h-full bg-[#3B82F6] transition-all duration-300"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-base font-mono font-bold text-[#F1F4FA]">
                        {formatDurationShort(daySpan)}
                      </div>
                      <div className="text-[10px] text-[#717E94] uppercase tracking-wide">
                        Total session duration
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Session List */}
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {selectedDay.sessions.map((session, index) => {
                      const isWork = session.type === 'WORK';
                      return (
                        <div
                          key={session.id || index}
                          className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg border transition-all text-xs ${
                            isWork
                              ? 'bg-[#141A17] border-[#9AB87A]/20 text-[#E6EBF5]'
                              : 'bg-[#1A1815] border-[#E2B068]/20 text-[#E6EBF5]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isWork ? 'bg-[#9AB87A]' : 'bg-[#E2B068]'
                              }`} 
                            />
                            <span className="font-medium text-[11px]">
                              {isWork ? 'Work Sprint' : 'Break'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-[#717E94]">
                              {formatClockTime(session.startTime)}
                            </span>
                            <span className={`font-semibold ${isWork ? 'text-[#9AB87A]' : 'text-[#E2B068]'}`}>
                              {formatDurationDetailed(session.durationMs)}
                            </span>
                            <button
                              onClick={() => onDeleteSession(session.id)}
                              className="p-1 text-[#717E94] hover:text-[#E56367] transition-colors"
                              aria-label="Delete session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 2. NEW WEEKLY ANALYTICS TAB                                               */}
      {/* ========================================================================= */}
      {activeTab === 'WEEK' && (
        <main id="weekly-analytics-content" className="space-y-3 animate-fade-in">
          {/* Week Selector */}
          <section 
            id="weekly-date-navigator"
            aria-label="Week Selector"
            className="flex items-center justify-between bg-[#121622] rounded-xl px-2 py-1.5 border border-[#1C2436]"
          >
            <button
              id="btn-prev-week"
              type="button"
              onClick={handlePrevWeek}
              disabled={!canGoPrevWeek}
              aria-label="Previous week"
              className="p-1.5 rounded-lg text-[#8B98AD] hover:text-white hover:bg-[#1C2436] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="text-xs font-semibold text-[#F1F4FA]">
                {selectedWeek?.weekLabel}
              </div>
              <div className="text-[10px] text-[#717E94] font-mono">
                {selectedWeek?.dateRangeLabel}
              </div>
            </div>

            <button
              id="btn-next-week"
              type="button"
              onClick={handleNextWeek}
              disabled={!canGoNextWeek}
              aria-label="Next week"
              className="p-1.5 rounded-lg text-[#8B98AD] hover:text-white hover:bg-[#1C2436] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>

          {/* Weekly Summary Highlights (2x2 Grid) */}
          <section 
            id="card-weekly-overview"
            aria-label="Weekly Metrics Overview"
            className="grid grid-cols-2 gap-2"
          >
            {/* Total Work */}
            <div className="bg-[#121622] border border-[#1C2436] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                  Total Work
                </span>
                <Briefcase className="w-3.5 h-3.5 text-[#9AB87A]" />
              </div>
              <div className="font-mono text-xl font-bold text-[#9AB87A]">
                {formatDurationShort(selectedWeek.totalWorkMs)}
              </div>
              <span className="text-[10px] text-[#717E94] block mt-0.5">
                {selectedWeek.activeDaysCount > 0 
                  ? `avg ${formatDurationShort(selectedWeek.avgDailyWorkMs)}/day` 
                  : 'no activity'}
              </span>
            </div>

            {/* Total Breaks */}
            <div className="bg-[#121622] border border-[#1C2436] rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                  Total Breaks
                </span>
                <Coffee className="w-3.5 h-3.5 text-[#E2B068]" />
              </div>
              <div className="font-mono text-xl font-bold text-[#E2B068]">
                {formatDurationShort(selectedWeek.totalBreakMs)}
              </div>
              <span className="text-[10px] text-[#717E94] block mt-0.5">
                {selectedWeek.activeDaysCount > 0 
                  ? `avg ${formatDurationShort(selectedWeek.totalBreakMs / selectedWeek.activeDaysCount)}/day` 
                  : 'no break data'}
              </span>
            </div>

            {/* Weekly Productivity Focus */}
            <div className="bg-[#121622] border border-[#1C2436] rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                  Focus Score
                </span>
                <Sparkles className="w-3.5 h-3.5 text-[#9AB87A]" />
              </div>
              <div>
                <div className="font-mono text-xl font-bold text-[#F1F4FA]">
                  {selectedWeek.productivityScore}%
                </div>
                <span className="text-[10px] text-[#717E94] block mt-0.5">
                  of total active time
                </span>
              </div>
            </div>

            {/* Best Work Day or Longest Break */}
            <div className="bg-[#121622] border border-[#1C2436] rounded-xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                  Top Day
                </span>
                <Calendar className="w-3.5 h-3.5 text-[#E2B068]" />
              </div>
              <div>
                <div className="font-mono text-base font-bold text-[#F1F4FA] truncate">
                  {selectedWeek.bestDay 
                    ? `${selectedWeek.bestDay.dayName} (${formatDurationShort(selectedWeek.bestDay.workMs)})`
                    : '—'}
                </div>
                <span className="text-[10px] text-[#717E94] block mt-0.5">
                  max focus day
                </span>
              </div>
            </div>
          </section>

          {/* 7-Day Visual Bar Chart */}
          <section 
            id="card-weekly-chart"
            aria-label="7-Day Activity Chart"
            className="bg-[#121622] border border-[#1C2436] rounded-xl p-3.5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                Daily Distribution
              </span>
              <div className="flex items-center gap-3 text-[10px] text-[#717E94]">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-[#9AB87A]" />
                  <span>Work</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-[#E2B068]" />
                  <span>Break</span>
                </div>
              </div>
            </div>

            {/* 7-Day Columns */}
            <div className="flex items-end justify-between gap-1.5 h-28 pt-2 px-1">
              {selectedWeek.days.map((day) => {
                const workHours = day.totalWorkMs / (3600 * 1000);
                const breakHours = day.totalBreakMs / (3600 * 1000);
                const workHeight = Math.min(100, (workHours / maxWeekDayHours) * 100);
                const breakHeight = Math.min(100, (breakHours / maxWeekDayHours) * 100);

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => handleSelectDayFromWeek(day.dateKey)}
                    title={`${day.dayName} ${day.shortDate}: ${formatDurationDetailed(day.totalWorkMs)} Work, ${formatDurationDetailed(day.totalBreakMs)} Break (Click to inspect day)`}
                    className="flex-1 flex flex-col items-center group cursor-pointer"
                  >
                    {/* Bar track */}
                    <div className="w-full flex items-end justify-center gap-1 h-20 relative">
                      {/* Work bar */}
                      <div
                        className="w-2.5 rounded-t-sm bg-[#9AB87A] transition-all duration-300 group-hover:brightness-125"
                        style={{ height: `${Math.max(day.hasData ? 6 : 2, workHeight)}%` }}
                      />
                      {/* Break bar */}
                      <div
                        className="w-2.5 rounded-t-sm bg-[#E2B068] transition-all duration-300 group-hover:brightness-125"
                        style={{ height: `${Math.max(day.hasData ? 6 : 2, breakHeight)}%` }}
                      />
                    </div>

                    {/* Day label */}
                    <div className="mt-2 text-center">
                      <span className={`text-[10px] font-semibold block leading-none ${
                        day.isToday ? 'text-[#9AB87A]' : 'text-[#8B98AD] group-hover:text-white'
                      }`}>
                        {day.dayName}
                      </span>
                      <span className="text-[8px] text-[#717E94] font-mono mt-0.5 block leading-none">
                        {day.shortDate.split('/')[0]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Day-by-Day Scannable Breakdown */}
          <section 
            id="card-weekly-breakdown"
            aria-label="Day by Day Breakdown"
            className="bg-[#121622] border border-[#1C2436] rounded-xl p-3.5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                Week View
              </span>
              <span className="text-[10px] text-[#717E94]">
                Tap day to view details
              </span>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {selectedWeek.days.map((day) => (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => handleSelectDayFromWeek(day.dateKey)}
                  className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-lg border border-[#1C2436] bg-[#0E121B]/70 hover:bg-[#161D2B] transition-all text-sm cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${day.isToday ? 'text-[#9AB87A]' : 'text-[#F1F4FA]'}`}>
                      {day.dayName}
                    </span>
                    <span className="text-xs text-[#717E94] font-mono">
                      {day.shortDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-sm">
                    <div className="text-[#9AB87A] font-medium w-14 text-right">
                      {day.totalWorkMs > 0 ? formatDurationShort(day.totalWorkMs) : '—'}
                    </div>
                    <div className="text-[#E2B068] font-medium w-14 text-right">
                      {day.totalBreakMs > 0 ? formatDurationShort(day.totalBreakMs) : '—'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
};
