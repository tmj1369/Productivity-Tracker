package com.productivity.tracker

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews

class ProductivityWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateAppWidget(context, appWidgetManager, appWidgetId)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action ?: return

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()

        var currentMode = prefs.getString(KEY_MODE, "IDLE") ?: "IDLE"
        var workMs = prefs.getLong(KEY_WORK_MS, 0L)
        var breakMs = prefs.getLong(KEY_BREAK_MS, 0L)
        val lastTimestamp = prefs.getLong(KEY_LAST_TIMESTAMP, now)

        when (action) {
            ACTION_START_WORK -> {
                if (currentMode != "WORK") {
                    if (currentMode == "BREAK") {
                        breakMs += (now - lastTimestamp).coerceAtLeast(0L)
                    }
                    currentMode = "WORK"
                    prefs.edit()
                        .putString(KEY_MODE, currentMode)
                        .putLong(KEY_WORK_MS, workMs)
                        .putLong(KEY_BREAK_MS, breakMs)
                        .putLong(KEY_LAST_TIMESTAMP, now)
                        .apply()
                }
            }
            ACTION_START_BREAK -> {
                if (currentMode != "BREAK") {
                    if (currentMode == "WORK") {
                        workMs += (now - lastTimestamp).coerceAtLeast(0L)
                    }
                    currentMode = "BREAK"
                    prefs.edit()
                        .putString(KEY_MODE, currentMode)
                        .putLong(KEY_WORK_MS, workMs)
                        .putLong(KEY_BREAK_MS, breakMs)
                        .putLong(KEY_LAST_TIMESTAMP, now)
                        .apply()
                }
            }
            ACTION_STOP -> {
                if (currentMode == "WORK") {
                    workMs += (now - lastTimestamp).coerceAtLeast(0L)
                } else if (currentMode == "BREAK") {
                    breakMs += (now - lastTimestamp).coerceAtLeast(0L)
                }
                currentMode = "IDLE"
                prefs.edit()
                    .putString(KEY_MODE, currentMode)
                    .putLong(KEY_WORK_MS, workMs)
                    .putLong(KEY_BREAK_MS, breakMs)
                    .putLong(KEY_LAST_TIMESTAMP, now)
                    .apply()
            }
            ACTION_RESET -> {
                currentMode = "IDLE"
                prefs.edit()
                    .putString(KEY_MODE, "IDLE")
                    .putLong(KEY_WORK_MS, 0L)
                    .putLong(KEY_BREAK_MS, 0L)
                    .putLong(KEY_LAST_TIMESTAMP, now)
                    .apply()
            }
        }

        // Trigger widget update for all active widgets
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val componentName = ComponentName(context, ProductivityWidgetProvider::class.java)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
        for (id in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id)
        }

        // Schedule next update based on active mode and whether 1 minute has elapsed
        val latestMode = prefs.getString(KEY_MODE, "IDLE") ?: "IDLE"
        val latestWork = prefs.getLong(KEY_WORK_MS, 0L)
        val latestBreak = prefs.getLong(KEY_BREAK_MS, 0L)
        val latestTs = prefs.getLong(KEY_LAST_TIMESTAMP, now)

        var activeElapsed = 0L
        if (latestMode == "WORK") {
            activeElapsed = latestWork + (System.currentTimeMillis() - latestTs).coerceAtLeast(0L)
        } else if (latestMode == "BREAK") {
            activeElapsed = latestBreak + (System.currentTimeMillis() - latestTs).coerceAtLeast(0L)
        }

        if (latestMode == "WORK" || latestMode == "BREAK") {
            val delayMs = if (activeElapsed < ONE_MINUTE_MS) {
                // In first minute: schedule alarm at the exact 1-minute mark to stop showing seconds
                (ONE_MINUTE_MS - activeElapsed).coerceAtLeast(1000L)
            } else {
                // After 1 minute: schedule next tick on the minute boundary (e.g. 1m -> 2m)
                val msIntoMinute = activeElapsed % ONE_MINUTE_MS
                (ONE_MINUTE_MS - msIntoMinute).coerceAtLeast(1000L)
            }
            scheduleNextUpdate(context, delayMs)
        } else {
            scheduleNextUpdate(context, 0L)
        }
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        scheduleNextUpdate(context, 0L)
    }

    companion object {
        const val PREFS_NAME = "productivity_tracker_prefs"
        const val KEY_MODE = "current_mode"
        const val KEY_WORK_MS = "work_accumulated_ms"
        const val KEY_BREAK_MS = "break_accumulated_ms"
        const val KEY_LAST_TIMESTAMP = "last_start_timestamp"

        const val ACTION_START_WORK = "com.productivity.tracker.ACTION_START_WORK"
        const val ACTION_START_BREAK = "com.productivity.tracker.ACTION_START_BREAK"
        const val ACTION_STOP = "com.productivity.tracker.ACTION_STOP"
        const val ACTION_RESET = "com.productivity.tracker.ACTION_RESET"
        const val ACTION_TICK = "com.productivity.tracker.ACTION_TICK"

        const val ONE_MINUTE_MS = 60_000L

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val currentMode = prefs.getString(KEY_MODE, "IDLE") ?: "IDLE"
                val workMs = prefs.getLong(KEY_WORK_MS, 0L)
                val breakMs = prefs.getLong(KEY_BREAK_MS, 0L)
                val lastTimestamp = prefs.getLong(KEY_LAST_TIMESTAMP, System.currentTimeMillis())

                val now = System.currentTimeMillis()
                val elapsedRealtime = SystemClock.elapsedRealtime()

                var currentWorkMs = workMs
                var currentBreakMs = breakMs

                if (currentMode == "WORK") {
                    currentWorkMs += (now - lastTimestamp).coerceAtLeast(0L)
                } else if (currentMode == "BREAK") {
                    currentBreakMs += (now - lastTimestamp).coerceAtLeast(0L)
                }

                val totalMs = currentWorkMs + currentBreakMs
                val workPct = if (totalMs > 0) ((currentWorkMs.toDouble() / totalMs) * 100).toInt() else 0
                val breakPct = if (totalMs > 0) 100 - workPct else 0

                val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
                val minHeight = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) ?: 0

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val compactViews = buildWidgetViews(
                        context, R.layout.widget_productivity,
                        currentMode, workMs, breakMs, currentWorkMs, currentBreakMs,
                        totalMs, workPct, breakPct, elapsedRealtime
                    )
                    val tallViews = buildWidgetViews(
                        context, R.layout.widget_productivity_tall,
                        currentMode, workMs, breakMs, currentWorkMs, currentBreakMs,
                        totalMs, workPct, breakPct, elapsedRealtime
                    )
                    val viewsMap = mapOf(
                        SizeF(120f, 60f) to compactViews,
                        SizeF(120f, 130f) to tallViews
                    )
                    appWidgetManager.updateAppWidget(appWidgetId, RemoteViews(viewsMap))
                } else {
                    val layoutId = if (minHeight >= 130) R.layout.widget_productivity_tall else R.layout.widget_productivity
                    val views = buildWidgetViews(
                        context, layoutId,
                        currentMode, workMs, breakMs, currentWorkMs, currentBreakMs,
                        totalMs, workPct, breakPct, elapsedRealtime
                    )
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }
            } catch (e: Exception) {
                android.util.Log.e("ProductivityWidget", "Error updating widget $appWidgetId: ${e.message}", e)
            }
        }

        private fun buildWidgetViews(
            context: Context,
            layoutId: Int,
            currentMode: String,
            workMs: Long,
            breakMs: Long,
            currentWorkMs: Long,
            currentBreakMs: Long,
            totalMs: Long,
            workPct: Int,
            breakPct: Int,
            elapsedRealtime: Long
        ): RemoteViews {
            val views = RemoteViews(context.packageName, layoutId)

            // Real-time ticking Chronometers & static text depending on active state
            when (currentMode) {
                "WORK" -> {
                    if (currentWorkMs < ONE_MINUTE_MS) {
                        // First minute: show live ticking Chronometer with seconds
                        val chronoBase = elapsedRealtime - currentWorkMs
                        views.setViewVisibility(R.id.widget_work_chrono, View.VISIBLE)
                        views.setViewVisibility(R.id.widget_work_time, View.GONE)
                        views.setChronometer(R.id.widget_work_chrono, chronoBase, null, true)
                    } else {
                        // A minute has passed: STOP showing seconds, show minutes only!
                        views.setViewVisibility(R.id.widget_work_chrono, View.GONE)
                        views.setChronometer(R.id.widget_work_chrono, 0L, null, false)
                        views.setViewVisibility(R.id.widget_work_time, View.VISIBLE)
                        views.setTextViewText(R.id.widget_work_time, formatDuration(currentWorkMs))
                    }

                    // Break is paused (show static text, no seconds if >= 1m)
                    views.setViewVisibility(R.id.widget_break_chrono, View.GONE)
                    views.setViewVisibility(R.id.widget_break_time, View.VISIBLE)
                    views.setChronometer(R.id.widget_break_chrono, 0L, null, false)
                    views.setTextViewText(R.id.widget_break_time, formatDuration(breakMs))

                    views.setTextViewText(R.id.widget_status, "● WORKING")
                    views.setTextColor(R.id.widget_status, Color.parseColor("#9AB87A"))
                }
                "BREAK" -> {
                    // Work is paused (show static text, no seconds if >= 1m)
                    views.setViewVisibility(R.id.widget_work_chrono, View.GONE)
                    views.setViewVisibility(R.id.widget_work_time, View.VISIBLE)
                    views.setChronometer(R.id.widget_work_chrono, 0L, null, false)
                    views.setTextViewText(R.id.widget_work_time, formatDuration(workMs))

                    if (currentBreakMs < ONE_MINUTE_MS) {
                        // First minute: show live ticking Chronometer with seconds
                        val chronoBase = elapsedRealtime - currentBreakMs
                        views.setViewVisibility(R.id.widget_break_chrono, View.VISIBLE)
                        views.setViewVisibility(R.id.widget_break_time, View.GONE)
                        views.setChronometer(R.id.widget_break_chrono, chronoBase, null, true)
                    } else {
                        // A minute has passed: STOP showing seconds, show minutes only!
                        views.setViewVisibility(R.id.widget_break_chrono, View.GONE)
                        views.setChronometer(R.id.widget_break_chrono, 0L, null, false)
                        views.setViewVisibility(R.id.widget_break_time, View.VISIBLE)
                        views.setTextViewText(R.id.widget_break_time, formatDuration(currentBreakMs))
                    }

                    views.setTextViewText(R.id.widget_status, "● ON BREAK")
                    views.setTextColor(R.id.widget_status, Color.parseColor("#E2B068"))
                }
                else -> {
                    // IDLE / STOPPED: Both Chronometers hidden, static text shown (no seconds if >= 1m)
                    views.setViewVisibility(R.id.widget_work_chrono, View.GONE)
                    views.setViewVisibility(R.id.widget_work_time, View.VISIBLE)
                    views.setChronometer(R.id.widget_work_chrono, 0L, null, false)
                    views.setTextViewText(R.id.widget_work_time, formatDuration(workMs))

                    views.setViewVisibility(R.id.widget_break_chrono, View.GONE)
                    views.setViewVisibility(R.id.widget_break_time, View.VISIBLE)
                    views.setChronometer(R.id.widget_break_chrono, 0L, null, false)
                    views.setTextViewText(R.id.widget_break_time, formatDuration(breakMs))

                    views.setTextViewText(R.id.widget_status, "IDLE")
                    views.setTextColor(R.id.widget_status, Color.parseColor("#717E94"))
                }
            }

            // Percentages & summary
            views.setTextViewText(R.id.widget_work_percent, "$workPct%")
            views.setTextViewText(R.id.widget_break_percent, "$breakPct%")
            views.setTextViewText(R.id.widget_total_time, "Total " + formatDuration(totalMs))
            views.setTextViewText(R.id.widget_balance_label, "Work $workPct% • Break $breakPct%")

            // Minimal Dual Progress Bar
            if (totalMs > 0) {
                views.setViewVisibility(R.id.widget_progress_empty, View.GONE)
                views.setViewVisibility(R.id.widget_progress_bar, View.VISIBLE)
                views.setProgressBar(R.id.widget_progress_bar, 100, workPct, false)
            } else {
                views.setViewVisibility(R.id.widget_progress_empty, View.VISIBLE)
                views.setViewVisibility(R.id.widget_progress_bar, View.GONE)
            }

            // Click Intents
            views.setOnClickPendingIntent(
                R.id.btn_widget_work,
                getBroadcastPendingIntent(context, ACTION_START_WORK)
            )
            views.setOnClickPendingIntent(
                R.id.btn_widget_break,
                getBroadcastPendingIntent(context, ACTION_START_BREAK)
            )
            views.setOnClickPendingIntent(
                R.id.btn_widget_stop,
                getBroadcastPendingIntent(context, ACTION_STOP)
            )

            // Open app on clicking header
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openAppPendingIntent = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_header_container, openAppPendingIntent)

            return views
        }

        private fun scheduleNextUpdate(context: Context, delayMs: Long) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, ProductivityWidgetProvider::class.java).apply {
                action = ACTION_TICK
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                999,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            if (delayMs > 0) {
                val triggerTime = SystemClock.elapsedRealtime() + delayMs
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, pendingIntent)
                } else {
                    alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, pendingIntent)
                }
            } else {
                alarmManager.cancel(pendingIntent)
            }
        }

        private fun getBroadcastPendingIntent(context: Context, action: String): PendingIntent {
            val intent = Intent(context, ProductivityWidgetProvider::class.java).apply {
                this.action = action
            }
            return PendingIntent.getBroadcast(
                context,
                action.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        /**
         * Formats duration: shows seconds ONLY until 1 minute has passed (e.g. "45s").
         * Once 1 minute or more has passed, seconds are omitted (e.g. "1m", "25m", "1h 10m").
         */
        private fun formatDuration(millis: Long): String {
            val totalSeconds = (millis / 1000).coerceAtLeast(0L)
            val hours = totalSeconds / 3600
            val minutes = (totalSeconds % 3600) / 60
            val seconds = totalSeconds % 60

            return if (hours > 0) {
                String.format("%dh %02dm", hours, minutes)
            } else if (minutes > 0) {
                String.format("%dm", minutes)
            } else if (totalSeconds > 0) {
                String.format("%02ds", seconds)
            } else {
                "0m"
            }
        }
    }
}
