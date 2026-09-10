package com.productivity.tracker

import android.annotation.SuppressLint
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Dark edge-to-edge styling
        window.statusBarColor = Color.parseColor("#07090F")
        window.navigationBarColor = Color.parseColor("#07090F")

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#07090F"))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                allowFileAccess = true
            }
            webViewClient = WebViewClient()
            addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidNative")
        }

        setContentView(webView)

        // Load built web assets or fallback
        webView.loadUrl("file:///android_asset/web/index.html")
    }

    override fun onResume() {
        super.onResume()
        // Update widget whenever app is paused or resumed
        notifyWidgetUpdate()
    }

    private fun notifyWidgetUpdate() {
        val intent = Intent(this, ProductivityWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        }
        val ids = AppWidgetManager.getInstance(this).getAppWidgetIds(
            ComponentName(this, ProductivityWidgetProvider::class.java)
        )
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        sendBroadcast(intent)
    }

    class WebAppInterface(private val context: Context) {
        private val prefs = context.getSharedPreferences(
            ProductivityWidgetProvider.PREFS_NAME,
            Context.MODE_PRIVATE
        )

        @JavascriptInterface
        fun getMode(): String = prefs.getString(ProductivityWidgetProvider.KEY_MODE, "IDLE") ?: "IDLE"

        @JavascriptInterface
        fun getWorkMs(): Long = prefs.getLong(ProductivityWidgetProvider.KEY_WORK_MS, 0L)

        @JavascriptInterface
        fun getBreakMs(): Long = prefs.getLong(ProductivityWidgetProvider.KEY_BREAK_MS, 0L)

        @JavascriptInterface
        fun getLastTimestamp(): Long = prefs.getLong(ProductivityWidgetProvider.KEY_LAST_TIMESTAMP, 0L)

        @JavascriptInterface
        fun syncState(mode: String, workMs: Long, breakMs: Long, timestamp: Long) {
            prefs.edit()
                .putString(ProductivityWidgetProvider.KEY_MODE, mode)
                .putLong(ProductivityWidgetProvider.KEY_WORK_MS, workMs)
                .putLong(ProductivityWidgetProvider.KEY_BREAK_MS, breakMs)
                .putLong(ProductivityWidgetProvider.KEY_LAST_TIMESTAMP, timestamp)
                .apply()

            val intent = Intent(context, ProductivityWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            }
            val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(
                ComponentName(context, ProductivityWidgetProvider::class.java)
            )
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            context.sendBroadcast(intent)
        }
    }
}
