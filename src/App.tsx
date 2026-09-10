import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  Play, 
  Coffee, 
  Square, 
  RotateCcw 
} from 'lucide-react';
import { TrackerStatus, TrackerState } from './types';
import { triggerHaptic } from './utils/audio';
import { createBackgroundWorker } from './utils/timerWorker';

const STORAGE_KEY = 'productivity_tracker_widget_state_v1';

const INITIAL_STATE: TrackerState = {
  status: 'IDLE',
  workElapsedMs: 0,
  breakElapsedMs: 0,
  activeStartTimestamp: null,
  lastUpdatedTimestamp: Date.now(),
  soundEnabled: false,
  history: []
};

// Format milliseconds into minutes/hours (no seconds)
function formatMinutes(totalMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(totalMs / 60000));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

export default function App() {
  const [tracker, setTracker] = useState<TrackerState>(() => {
    // Check if Android Native bridge is available
    if (typeof window !== 'undefined' && (window as unknown as { AndroidNative?: { getMode: () => string; getWorkMs: () => number; getBreakMs: () => number; getLastTimestamp: () => number } }).AndroidNative?.getMode) {
      try {
        const bridge = (window as unknown as { AndroidNative: { getMode: () => string; getWorkMs: () => number; getBreakMs: () => number; getLastTimestamp: () => number } }).AndroidNative;
        const mode = bridge.getMode();
        const workMs = Number(bridge.getWorkMs()) || 0;
        const breakMs = Number(bridge.getBreakMs()) || 0;
        const lastTs = Number(bridge.getLastTimestamp()) || null;
        if (mode === 'WORK' || mode === 'BREAK' || workMs > 0 || breakMs > 0) {
          return {
            status: mode === 'WORK' ? 'WORK' : mode === 'BREAK' ? 'BREAK' : 'IDLE',
            workElapsedMs: workMs,
            breakElapsedMs: breakMs,
            activeStartTimestamp: (mode === 'WORK' || mode === 'BREAK') ? (lastTs || Date.now()) : null,
            lastUpdatedTimestamp: Date.now(),
            soundEnabled: false,
            history: []
          };
        }
      } catch (e) {
        console.warn('Native bridge load error:', e);
      }
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as TrackerState;
      }
    } catch (e) {
      console.error('Failed to load tracker state from localStorage:', e);
    }
    return INITIAL_STATE;
  });

  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize and calculate active runtimes
  const { currentWorkMs, currentBreakMs } = useMemo(() => {
    let work = tracker.workElapsedMs;
    let brk = tracker.breakElapsedMs;

    if (tracker.status === 'WORK' && tracker.activeStartTimestamp) {
      const delta = Math.max(0, currentTime - tracker.activeStartTimestamp);
      work += delta;
    } else if (tracker.status === 'BREAK' && tracker.activeStartTimestamp) {
      const delta = Math.max(0, currentTime - tracker.activeStartTimestamp);
      brk += delta;
    }

    return {
      currentWorkMs: work,
      currentBreakMs: brk
    };
  }, [tracker, currentTime]);

  const showToast = useCallback((msg: string) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setNotificationMsg(msg);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotificationMsg(null);
    }, 1800);
  }, []);

  // Update document title with current timer in minutes
  useEffect(() => {
    const formattedWork = formatMinutes(currentWorkMs);
    const formattedBreak = formatMinutes(currentBreakMs);
    
    if (tracker.status === 'WORK') {
      document.title = `▶ Work ${formattedWork}`;
    } else if (tracker.status === 'BREAK') {
      document.title = `☕ Break ${formattedBreak}`;
    } else {
      document.title = `Productivity Tracker`;
    }
  }, [tracker.status, currentWorkMs, currentBreakMs]);

  // Persist state to LocalStorage and Android Native Widget
  const saveStateToStorage = useCallback((stateToSave: TrackerState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      if (typeof window !== 'undefined') {
        const nativeBridge = (window as unknown as { AndroidNative?: { syncState: (mode: string, work: number, brk: number, ts: number) => void } }).AndroidNative;
        if (nativeBridge?.syncState) {
          nativeBridge.syncState(
            stateToSave.status,
            stateToSave.workElapsedMs,
            stateToSave.breakElapsedMs,
            stateToSave.activeStartTimestamp || Date.now()
          );
        }
      }
    } catch (err) {
      console.warn('Unable to write state to localStorage:', err);
    }
  }, []);

  // Sync to LocalStorage on tracker changes
  useEffect(() => {
    saveStateToStorage(tracker);
  }, [tracker, saveStateToStorage]);

  // Save on page beforeunload / hide
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveStateToStorage(tracker);
    };
    const handleVisibilityChange = () => {
      setCurrentTime(Date.now());
      if (document.visibilityState === 'hidden') {
        saveStateToStorage(tracker);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tracker, saveStateToStorage]);

  // Background Web Worker and timer loop
  useEffect(() => {
    const cleanupWorker = createBackgroundWorker(() => {
      setCurrentTime(Date.now());
    });

    const fallbackInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      cleanupWorker();
      clearInterval(fallbackInterval);
    };
  }, []);

  // Button Action: Start Work
  const handleStartWork = useCallback(() => {
    if (tracker.status === 'WORK') {
      showToast('Work running');
      return;
    }

    const now = Date.now();
    let newWorkElapsed = tracker.workElapsedMs;
    let newBreakElapsed = tracker.breakElapsedMs;

    if (tracker.status === 'BREAK' && tracker.activeStartTimestamp) {
      newBreakElapsed += Math.max(0, now - tracker.activeStartTimestamp);
    }

    const newState: TrackerState = {
      ...tracker,
      status: 'WORK',
      workElapsedMs: newWorkElapsed,
      breakElapsedMs: newBreakElapsed,
      activeStartTimestamp: now,
      lastUpdatedTimestamp: now
    };

    triggerHaptic(30);
    setTracker(newState);
    saveStateToStorage(newState);
    setCurrentTime(now);
    showToast('Work started');
  }, [tracker, saveStateToStorage, showToast]);

  // Button Action: Take Break
  const handleTakeBreak = useCallback(() => {
    if (tracker.status === 'BREAK') {
      showToast('Break running');
      return;
    }

    const now = Date.now();
    let newWorkElapsed = tracker.workElapsedMs;
    let newBreakElapsed = tracker.breakElapsedMs;

    if (tracker.status === 'WORK' && tracker.activeStartTimestamp) {
      newWorkElapsed += Math.max(0, now - tracker.activeStartTimestamp);
    }

    const newState: TrackerState = {
      ...tracker,
      status: 'BREAK',
      workElapsedMs: newWorkElapsed,
      breakElapsedMs: newBreakElapsed,
      activeStartTimestamp: now,
      lastUpdatedTimestamp: now
    };

    triggerHaptic(30);
    setTracker(newState);
    saveStateToStorage(newState);
    setCurrentTime(now);
    showToast('Break started');
  }, [tracker, saveStateToStorage, showToast]);

  // Button Action: Stop
  const handleStop = useCallback(() => {
    if (tracker.status === 'IDLE') {
      showToast('Already paused');
      return;
    }

    const now = Date.now();
    let newWorkElapsed = tracker.workElapsedMs;
    let newBreakElapsed = tracker.breakElapsedMs;

    if (tracker.status === 'WORK' && tracker.activeStartTimestamp) {
      newWorkElapsed += Math.max(0, now - tracker.activeStartTimestamp);
    } else if (tracker.status === 'BREAK' && tracker.activeStartTimestamp) {
      newBreakElapsed += Math.max(0, now - tracker.activeStartTimestamp);
    }

    const newState: TrackerState = {
      ...tracker,
      status: 'IDLE',
      workElapsedMs: newWorkElapsed,
      breakElapsedMs: newBreakElapsed,
      activeStartTimestamp: null,
      lastUpdatedTimestamp: now
    };

    triggerHaptic(20);
    setTracker(newState);
    saveStateToStorage(newState);
    setCurrentTime(now);
    showToast('Paused');
  }, [tracker, saveStateToStorage, showToast]);

  // Reset all timers
  const handleResetConfirm = useCallback(() => {
    const newState: TrackerState = {
      ...INITIAL_STATE,
      lastUpdatedTimestamp: Date.now()
    };
    setTracker(newState);
    saveStateToStorage(newState);
    setCurrentTime(Date.now());
    setShowResetConfirm(false);
    triggerHaptic(50);
    showToast('Reset');
  }, [saveStateToStorage, showToast]);

  // Time calculations in minutes
  const workFormatted = formatMinutes(currentWorkMs);
  const breakFormatted = formatMinutes(currentBreakMs);
  const totalTrackedMs = currentWorkMs + currentBreakMs;
  const totalMinutes = Math.floor(totalTrackedMs / 60000);
  const totalFormatted = formatMinutes(totalTrackedMs);
  const workPercentage = totalTrackedMs > 0 ? Math.round((currentWorkMs / totalTrackedMs) * 100) : 0;
  const breakPercentage = totalTrackedMs > 0 ? 100 - workPercentage : 0;

  return (
    <div className="min-h-screen bg-[#07090F] text-[#F1F4FA] flex items-center justify-center p-4 font-sans antialiased selection:bg-[#9AB87A]/25 selection:text-[#9AB87A]">
      {/* Minimal Widget Container */}
      <main 
        id="tracker-widget"
        className="w-full max-w-[310px] bg-[#0E121B] rounded-2xl p-4 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6),0_2px_8px_-2px_rgba(0,0,0,0.4)] border border-[#1A2232] relative transition-all"
      >
        {/* Top Minimal Bar: Status Pill & Subtle Controls */}
        <header className="flex items-center justify-between pb-3 z-10 relative">
          {/* Status Pill */}
          <div 
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide transition-all ${
              tracker.status === 'WORK'
                ? 'bg-[#9AB87A]/15 text-[#9AB87A] border border-[#9AB87A]/35'
                : tracker.status === 'BREAK'
                ? 'bg-[#E2B068]/15 text-[#E2B068] border border-[#E2B068]/35'
                : 'bg-[#D33E43]/15 text-[#E56367] border border-[#D33E43]/35'
            }`}
          >
            <span 
              className={`w-1.5 h-1.5 rounded-full ${
                tracker.status === 'WORK' 
                  ? 'bg-[#9AB87A] animate-pulse' 
                  : tracker.status === 'BREAK' 
                  ? 'bg-[#E2B068] animate-pulse' 
                  : 'bg-[#D33E43]'
              }`} 
            />
            <span>
              {tracker.status === 'WORK' && 'Working'}
              {tracker.status === 'BREAK' && 'On Break'}
              {tracker.status === 'IDLE' && 'Paused'}
            </span>
          </div>

          {/* Minimal Icon Actions */}
          <div className="flex items-center">
            <button
              id="btn-open-reset"
              onClick={() => setShowResetConfirm(true)}
              aria-label="Reset timers"
              title="Reset progress"
              className="p-1.5 rounded-lg text-[#7E8B9F] hover:text-[#E56367] hover:bg-[#D33E43]/10 active:scale-95 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Floating Minimal Toast */}
        {notificationMsg && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-[#171E2D] border border-[#263145] text-[#E0E5F0] text-[10px] font-medium rounded-full shadow-lg z-20 transition-all">
            {notificationMsg}
          </div>
        )}

        {/* Dual Timers Grid in Minutes */}
        <section className="mb-3 grid grid-cols-2 gap-2" aria-label="Timer Displays">
          {/* Work Timer Card */}
          <div 
            id="card-work-timer"
            className={`p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
              tracker.status === 'WORK' 
                ? 'bg-[#9AB87A]/10 border-[#9AB87A]/50 shadow-xs ring-1 ring-[#9AB87A]/30' 
                : 'bg-[#121622] border-[#1C2436]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                Work
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${tracker.status === 'WORK' ? 'bg-[#9AB87A]' : 'bg-transparent'}`} />
            </div>

            <div className="flex items-baseline justify-between gap-1 mt-auto">
              <span className={`font-mono text-2xl sm:text-[26px] leading-none font-bold tracking-tight tabular-nums ${
                tracker.status === 'WORK' ? 'text-[#9AB87A]' : 'text-[#F1F4FA]'
              }`}>
                {workFormatted}
              </span>
              <span className="text-xs font-mono font-semibold leading-none text-[#9AB87A] shrink-0">
                {totalTrackedMs > 0 ? `${workPercentage}%` : '0%'}
              </span>
            </div>
          </div>

          {/* Break Timer Card */}
          <div 
            id="card-break-timer"
            className={`p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
              tracker.status === 'BREAK' 
                ? 'bg-[#E2B068]/10 border-[#E2B068]/50 shadow-xs ring-1 ring-[#E2B068]/30' 
                : 'bg-[#121622] border-[#1C2436]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8B98AD]">
                Break
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${tracker.status === 'BREAK' ? 'bg-[#E2B068]' : 'bg-transparent'}`} />
            </div>

            <div className="flex items-baseline justify-between gap-1 mt-auto">
              <span className={`font-mono text-2xl sm:text-[26px] leading-none font-bold tracking-tight tabular-nums ${
                tracker.status === 'BREAK' ? 'text-[#E2B068]' : 'text-[#F1F4FA]'
              }`}>
                {breakFormatted}
              </span>
              <span className="text-xs font-mono font-semibold leading-none text-[#E2B068] shrink-0">
                {totalTrackedMs > 0 ? `${breakPercentage}%` : '0%'}
              </span>
            </div>
          </div>
        </section>

        {/* Minimal Progress Bar */}
        <section className="mb-3.5 px-0.5" aria-label="Productivity Balance">
          <div className="w-full h-2 bg-[#161C2A] rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-[#9AB87A] transition-all duration-300"
              style={{ width: `${totalTrackedMs > 0 ? workPercentage : 50}%` }}
              title={`Work: ${workPercentage}%`}
            />
            <div 
              className="h-full bg-[#E2B068] transition-all duration-300"
              style={{ width: `${totalTrackedMs > 0 ? breakPercentage : 50}%` }}
              title={`Break: ${breakPercentage}%`}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-[#717E94] font-mono mt-1.5">
            <span>Total {totalFormatted}</span>
            <span className="text-[#9AB87A]/90">{workPercentage}% Work</span>
          </div>
        </section>

        {/* 3 Distinct Buttons: Icons Only */}
        <nav 
          id="timer-controls"
          aria-label="Timer Controls"
          className="grid grid-cols-3 gap-2"
        >
          {/* 1. Start Work Button (Icon only) */}
          <button
            id="btn-start-work"
            type="button"
            onClick={handleStartWork}
            aria-label="Start Work"
            title="Start Work"
            className={`h-11 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none active:scale-[0.96] ${
              tracker.status === 'WORK'
                ? 'bg-[#9AB87A] text-[#07090F] shadow-md shadow-[#9AB87A]/25 ring-2 ring-[#9AB87A]/40'
                : 'bg-[#121A1A] text-[#9AB87A] border border-[#9AB87A]/35 hover:bg-[#9AB87A]/15 hover:border-[#9AB87A]/55'
            }`}
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </button>

          {/* 2. Take Break Button (Icon only) */}
          <button
            id="btn-take-break"
            type="button"
            onClick={handleTakeBreak}
            aria-label="Take Break"
            title="Take Break"
            className={`h-11 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none active:scale-[0.96] ${
              tracker.status === 'BREAK'
                ? 'bg-[#E2B068] text-[#07090F] shadow-md shadow-[#E2B068]/25 ring-2 ring-[#E2B068]/40'
                : 'bg-[#1A1817] text-[#E2B068] border border-[#E2B068]/35 hover:bg-[#E2B068]/15 hover:border-[#E2B068]/55'
            }`}
          >
            <Coffee className="w-4 h-4" />
          </button>

          {/* 3. Stop Button (Icon only with exact #D33E43 red) */}
          <button
            id="btn-stop"
            type="button"
            onClick={handleStop}
            aria-label="Stop"
            title="Stop"
            className={`h-11 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer select-none active:scale-[0.96] ${
              tracker.status === 'IDLE'
                ? 'bg-[#1C1216] border border-[#D33E43]/35 hover:bg-[#D33E43]/15 hover:border-[#D33E43]/60'
                : 'bg-[#D33E43]/20 border border-[#D33E43]/70 ring-1 ring-[#D33E43]/40'
            }`}
          >
            <Square className="w-4 h-4 fill-[#D33E43] text-[#D33E43]" />
          </button>
        </nav>

        {/* Minimal Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div 
            id="modal-reset-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="absolute inset-0 bg-[#07090F]/85 backdrop-blur-xs z-30 flex items-center justify-center p-3 rounded-2xl animate-fade-in"
          >
            <div className="w-full bg-[#111622] border border-[#222C3E] rounded-xl p-3.5 shadow-2xl text-center">
              <h2 id="reset-dialog-title" className="text-xs font-semibold text-[#F1F4FA]">
                Reset Timers?
              </h2>
              <p className="text-[10px] text-[#8B98AD] mt-0.5 mb-3">
                This will reset work and break counters to zero.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-cancel-reset"
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-medium bg-[#1A2232] hover:bg-[#232D42] text-[#D0D6E2] active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-reset"
                  type="button"
                  onClick={handleResetConfirm}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-medium bg-[#D33E43] hover:bg-[#BF353A] text-white active:scale-95 transition-all shadow-sm shadow-[#D33E43]/30"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
