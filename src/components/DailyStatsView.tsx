import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Coffee, 
  Briefcase, 
  TrendingUp, 
  Clock, 
  Award, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  BarChart2,
  Calendar,
  Layers
} from 'lucide-react';
import { DaySummary, SessionInterval } from '../types';
import { formatDurationDetailed, formatClockTime } from '../utils/statsHelper';

interface DailyStatsViewProps {
  daySummaries: DaySummary[];
  onBackToTimer: () => void;
}

export const DailyStatsView: React.FC<DailyStatsViewProps> = ({
  daySummaries,
  onBackToTimer,
}) => {
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);

  const selectedDay = daySummaries[selectedDateIndex] || daySummaries[0];

  const canGoPrev = selectedDateIndex < daySummaries.length - 1;
  const canGoNext = selectedDateIndex > 0;

  const handlePrevDay = () => {
    if (canGoPrev) {
      setSelectedDateIndex((prev) => prev + 1);
    }
  };

  const handleNextDay = () => {
    if (canGoNext) {
      setSelectedDateIndex((prev) => prev - 1);
    }
  };

  // Find longest break session if any
  const longestBreakSession = selectedDay?.sessions.find(
    (s) => s.type === 'BREAK' && s.durationMs === selectedDay.longestBreakMs && s.durationMs > 0
  );

  // 7-day trend data (take latest 7 summaries reversed for chronological left-to-right)
  const recentDays = daySummaries.slice(0, 7).reverse();
  const maxTotalHours = Math.max(
    ...recentDays.map((d) => (d.totalMs > 0 ? d.totalMs / (1000 * 3600) : 4)),
    6
  );

  return (
    <div className="w-full max-w-md bg-[#0E121B] rounded-2xl p-4 sm:p-5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6),0_2px_8px_-2px_rgba(0,0,0,0.4)] border border-[#1A2232] text-[#F1F4FA] animate-fade-in">
      {/* Navigation Header */}
      <header className="flex items-center justify-between pb-3 border-b border-[#1A2232] mb-3.5">
        <button
          id="btn-back-to-timer"
          type="button"
          onClick={onBackToTimer}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#8B98AD] hover:text-[#F1F4FA] hover:bg-[#161D2B] transition-colors active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Timer</span>
        </button>

        <div className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-[#8B98AD]">
          <BarChart2 className="w-3.5 h-3.5 text-[#9AB87A]" />
          <span>Daily Analytics</span>
        </div>

        <div className="w-14" /> {/* Spacer balance */}
      </header>

      {/* Date Navigation Strip */}
      <section aria-label="Date Navigation" className="mb-4">
        <div className="flex items-center justify-between bg-[#121622] rounded-xl p-1.5 border border-[#1C2436]">
          <button
            id="btn-prev-day"
            type="button"
            onClick={handlePrevDay}
            disabled={!canGoPrev}
            aria-label="Previous day"
            className="p-1.5 rounded-lg text-[#8B98AD] hover:text-white hover:bg-[#1C2436] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center">
            <div className="text-xs font-semibold text-[#F1F4FA]">
              {selectedDay?.dateLabel}
            </div>
            <div className="text-[10px] text-[#717E94] font-mono">
              {selectedDay?.dateKey}
            </div>
          </div>

          <button
            id="btn-next-day"
            type="button"
            onClick={handleNextDay}
            disabled={!canGoNext}
            aria-label="Next day"
            className="p-1.5 rounded-lg text-[#8B98AD] hover:text-white hover:bg-[#1C2436] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Date Chips */}
        <div className="flex items-center justify-between gap-1 mt-2 px-0.5">
          {daySummaries.slice(0, 5).map((summary, idx) => {
            const isSelected = summary.dateKey === selectedDay?.dateKey;
            return (
              <button
                key={summary.dateKey}
                type="button"
                onClick={() => setSelectedDateIndex(idx)}
                className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-medium transition-all text-center ${
                  isSelected
                    ? 'bg-[#9AB87A]/20 text-[#9AB87A] border border-[#9AB87A]/40'
                    : 'bg-[#121622] text-[#717E94] hover:text-[#9DAEC6] border border-transparent'
                }`}
              >
                <div>{summary.dateLabel.split(',')[0]}</div>
                <div className="font-mono text-[9px] font-semibold mt-0.5">
                  {summary.totalMs > 0 ? `${summary.productivityScore}%` : '—'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Productivity Hero Card */}
      <section 
        id="card-productivity-score"
        aria-label="Productivity Summary"
        className="bg-[#121622] border border-[#1C2436] rounded-xl p-3.5 mb-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
              Productivity Score
            </span>
          </div>

          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            selectedDay.productivityScore >= 75
              ? 'bg-[#9AB87A]/15 text-[#9AB87A] border-[#9AB87A]/30'
              : selectedDay.productivityScore >= 50
              ? 'bg-[#E2B068]/15 text-[#E2B068] border-[#E2B068]/30'
              : 'bg-[#717E94]/15 text-[#8B98AD] border-[#717E94]/30'
          }`}>
            {selectedDay.productivityScore >= 80 ? 'Peak Focus' : selectedDay.productivityScore >= 60 ? 'Healthy Balance' : selectedDay.totalMs === 0 ? 'No Data' : 'Light Session'}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-2.5">
          <span className="text-3xl sm:text-4xl font-mono font-bold text-[#9AB87A] tracking-tight">
            {selectedDay.productivityScore}%
          </span>
          <span className="text-xs text-[#8B98AD]">
            of logged time spent working
          </span>
        </div>

        {/* Dual Progress Bar */}
        <div className="w-full h-2 bg-[#161C2A] rounded-full overflow-hidden flex mb-2.5">
          <div 
            className="h-full bg-[#9AB87A] transition-all duration-300"
            style={{ width: `${selectedDay.totalMs > 0 ? selectedDay.productivityScore : 50}%` }}
          />
          <div 
            className="h-full bg-[#E2B068] transition-all duration-300"
            style={{ width: `${selectedDay.totalMs > 0 ? 100 - selectedDay.productivityScore : 50}%` }}
          />
        </div>

        {/* Work vs Break Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1C2436]/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#9AB87A]/15 text-[#9AB87A] flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-[#717E94]">Work Time</div>
              <div className="text-xs font-mono font-semibold text-[#9AB87A]">
                {formatDurationDetailed(selectedDay.totalWorkMs)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#E2B068]/15 text-[#E2B068] flex items-center justify-center">
              <Coffee className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-[#717E94]">Break Time</div>
              <div className="text-xs font-mono font-semibold text-[#E2B068]">
                {formatDurationDetailed(selectedDay.totalBreakMs)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Break Frequency & Longest Break Grid (User's specific questions) */}
      <section 
        aria-label="Break Analysis"
        className="grid grid-cols-2 gap-2.5 mb-3"
      >
        {/* 1. How often I took a break */}
        <div 
          id="card-break-frequency"
          className="bg-[#121622] border border-[#1C2436] rounded-xl p-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                Break Frequency
              </span>
              <Coffee className="w-3.5 h-3.5 text-[#E2B068]" />
            </div>
            <div className="font-mono text-2xl font-bold text-[#F1F4FA] mt-0.5">
              {selectedDay.breakCount}
              <span className="text-xs font-normal text-[#717E94] ml-1">
                {selectedDay.breakCount === 1 ? 'break' : 'breaks'}
              </span>
            </div>
          </div>

          <div className="mt-2 text-[10px] text-[#8B98AD] leading-tight pt-1.5 border-t border-[#1C2436]/60">
            {selectedDay.workSessionCount > 0 && selectedDay.breakCount > 0 ? (
              <span>Avg sprint: <strong className="text-[#9AB87A]">{formatDurationDetailed(selectedDay.avgWorkSessionMs)}</strong> before resting</span>
            ) : (
              <span>No breaks taken yet</span>
            )}
          </div>
        </div>

        {/* 2. Longest break */}
        <div 
          id="card-longest-break"
          className="bg-[#121622] border border-[#1C2436] rounded-xl p-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                Longest Break
              </span>
              <Clock className="w-3.5 h-3.5 text-[#E2B068]" />
            </div>
            <div className="font-mono text-2xl font-bold text-[#E2B068] mt-0.5">
              {selectedDay.longestBreakMs > 0 ? formatDurationDetailed(selectedDay.longestBreakMs) : '0m'}
            </div>
          </div>

          <div className="mt-2 text-[10px] text-[#8B98AD] leading-tight pt-1.5 border-t border-[#1C2436]/60">
            {selectedDay.breakCount > 0 ? (
              <span>Average break: <strong className="text-[#E2B068]">{formatDurationDetailed(selectedDay.avgBreakMs)}</strong></span>
            ) : (
              <span>None recorded</span>
            )}
          </div>
        </div>
      </section>

      {/* Suggested View: 7-Day Trend Comparison */}
      <section 
        id="card-week-trend"
        aria-label="Weekly Trend"
        className="bg-[#121622] border border-[#1C2436] rounded-xl p-3.5 mb-3"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#9AB87A]" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
              Recent 7 Days Activity
            </span>
          </div>
          <span className="text-[10px] text-[#717E94] font-mono">
            Work / Break Hours
          </span>
        </div>

        {/* 7-day mini bar chart */}
        <div className="flex items-end justify-between gap-2 h-24 pt-2 px-1">
          {recentDays.map((day) => {
            const isSelected = day.dateKey === selectedDay.dateKey;
            const workHours = day.totalWorkMs / (1000 * 3600);
            const breakHours = day.totalBreakMs / (1000 * 3600);
            const workHeightPct = Math.min(100, (workHours / maxTotalHours) * 100);
            const breakHeightPct = Math.min(100, (breakHours / maxTotalHours) * 100);

            const dayName = new Date(day.dateKey.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'narrow' });

            return (
              <div 
                key={day.dateKey}
                onClick={() => {
                  const idx = daySummaries.findIndex(s => s.dateKey === day.dateKey);
                  if (idx !== -1) setSelectedDateIndex(idx);
                }}
                className={`flex-1 flex flex-col items-center cursor-pointer group transition-all`}
                title={`${day.dateLabel}: ${formatDurationDetailed(day.totalWorkMs)} Work, ${formatDurationDetailed(day.totalBreakMs)} Break`}
              >
                {/* Dual stacked mini bars */}
                <div className="w-full flex items-end justify-center gap-0.5 h-16 relative">
                  {/* Work bar */}
                  <div 
                    className={`w-2.5 rounded-t-sm transition-all duration-300 ${
                      isSelected ? 'bg-[#9AB87A]' : 'bg-[#9AB87A]/50 group-hover:bg-[#9AB87A]'
                    }`}
                    style={{ height: `${Math.max(4, workHeightPct)}%` }}
                  />
                  {/* Break bar */}
                  <div 
                    className={`w-2.5 rounded-t-sm transition-all duration-300 ${
                      isSelected ? 'bg-[#E2B068]' : 'bg-[#E2B068]/50 group-hover:bg-[#E2B068]'
                    }`}
                    style={{ height: `${Math.max(4, breakHeightPct)}%` }}
                  />
                </div>

                <span className={`text-[10px] mt-1.5 font-medium transition-colors ${
                  isSelected ? 'text-[#9AB87A] font-bold' : 'text-[#717E94] group-hover:text-white'
                }`}>
                  {dayName}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] text-[#717E94] mt-2 pt-2 border-t border-[#1C2436]/60">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#9AB87A]" />
            <span>Work Time</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#E2B068]" />
            <span>Break Time</span>
          </div>
        </div>
      </section>

      {/* Suggested View: Chronological Session Log for the Day */}
      <section 
        id="card-session-log"
        aria-label="Session Log"
        className="bg-[#121622] border border-[#1C2436] rounded-xl p-3.5"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#8B98AD]" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
              Interval Timeline ({selectedDay.sessions.length})
            </span>
          </div>
          <span className="text-[10px] text-[#717E94]">
            Total {formatDurationDetailed(selectedDay.totalMs)}
          </span>
        </div>

        {selectedDay.sessions.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#717E94]">
            No completed intervals logged for this day yet.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {selectedDay.sessions.map((session, index) => {
              const isWork = session.type === 'WORK';
              const isLongest = !isWork && session.id === longestBreakSession?.id;

              return (
                <div
                  key={session.id || index}
                  className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg border transition-all text-xs ${
                    isWork
                      ? 'bg-[#151D18]/70 border-[#9AB87A]/25 text-[#E6EBF5]'
                      : 'bg-[#1C1814]/70 border-[#E2B068]/25 text-[#E6EBF5]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className={`w-1.5 h-1.5 rounded-full ${
                        isWork ? 'bg-[#9AB87A]' : 'bg-[#E2B068]'
                      }`} 
                    />
                    <span className="font-medium text-[11px]">
                      {isWork ? 'Work Sprint' : 'Break'}
                    </span>
                    {isLongest && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-[#E2B068]/20 text-[#E2B068] border border-[#E2B068]/40">
                        Longest
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-[#717E94]">
                      {formatClockTime(session.startTime)}
                    </span>
                    <span className={`font-semibold ${isWork ? 'text-[#9AB87A]' : 'text-[#E2B068]'}`}>
                      {formatDurationDetailed(session.durationMs)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Productivity Insight Advice */}
      <footer className="mt-3 p-2.5 bg-[#121622]/60 border border-[#1C2436] rounded-xl flex items-start gap-2 text-[10px] text-[#8B98AD] leading-relaxed">
        <Sparkles className="w-3.5 h-3.5 text-[#E2B068] shrink-0 mt-0.5" />
        <div>
          {selectedDay.productivityScore >= 80 ? (
            <span><strong>Excellent Focus:</strong> You maintained an 80%+ work rhythm. Remember to hydrate during short breaks to sustain attention.</span>
          ) : selectedDay.breakCount > 4 ? (
            <span><strong>Healthy Micro-breaks:</strong> Taking consistent breaks every ~50 minutes aligns with peak cognitive stamina research.</span>
          ) : (
            <span><strong>Tip:</strong> Aim for a work-to-break ratio between 75% and 85% for balanced stamina throughout long workdays.</span>
          )}
        </div>
      </footer>
    </div>
  );
};
