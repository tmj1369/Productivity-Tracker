package com.productivity.tracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.SystemClock
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
                // If previously working, do nothing
                if (currentMode != "WORK") {
                    // If on break, accumulate break time
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
                    // If working, accumulate work time
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
                // Accumulate whichever was running and pause
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

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val currentMode = prefs.getString(KEY_MODE, "IDLE") ?: "IDLE"
            var workMs = prefs.getLong(KEY_WORK_MS, 0L)
            var breakMs = prefs.getLong(KEY_BREAK_MS, 0L)
            val lastTimestamp = prefs.getLong(KEY_LAST_TIMESTAMP, System.currentTimeMillis())

            val now = System.currentTimeMillis()
            if (currentMode == "WORK") {
                workMs += (now - lastTimestamp).coerceAtLeast(0L)
            } else if (currentMode == "BREAK") {
                breakMs += (now - lastTimestamp).coerceAtLeast(0L)
            }

            val totalMs = workMs + breakMs
            val workPct = if (totalMs > 0) ((workMs.toDouble() / totalMs) * 100).toInt() else 0
            val breakPct = if (totalMs > 0) 100 - workPct else 0

            val views = RemoteViews(context.packageName, R.layout.widget_productivity)

            // Times
            views.setTextViewText(R.id.widget_work_time, formatDuration(workMs))
            views.setTextViewText(R.id.widget_break_time, formatDuration(breakMs))
            views.setTextViewText(R.id.widget_work_percent, "$workPct%")
            views.setTextViewText(R.id.widget_break_percent, "$breakPct%")
            views.setTextViewText(R.id.widget_total_time, "Total " + formatDuration(totalMs))
            views.setTextViewText(R.id.widget_balance_label, "Work $workPct% • Break $breakPct%")

            // Status label & color
            when (currentMode) {
                "WORK" -> {
                    views.setTextViewText(R.id.widget_status, "● WORKING")
                    views.setTextColor(R.id.widget_status, Color.parseColor("#9AB87A"))
                }
                "BREAK" -> {
                    views.setTextViewText(R.id.widget_status, "● ON BREAK")
                    views.setTextColor(R.id.widget_status, Color.parseColor("#E2B068"))
                }
                else -> {
                    views.setTextViewText(R.id.widget_status, "IDLE")
                    views.setTextColor(R.id.widget_status, Color.parseColor("#717E94"))
                }
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

            appWidgetManager.updateAppWidget(appWidgetId, views)
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

        private fun formatDuration(millis: Long): String {
            val totalSeconds = millis / 1000
            val hours = totalSeconds / 3600
            val minutes = (totalSeconds % 3600) / 60
            val seconds = totalSeconds % 60

            return if (hours > 0) {
                String.format("%dh %02dm", hours, minutes)
            } else if (minutes > 0) {
                String.format("%dm %02ds", minutes, seconds)
            } else {
                String.format("%02ds", seconds)
            }
        }
    }
}
