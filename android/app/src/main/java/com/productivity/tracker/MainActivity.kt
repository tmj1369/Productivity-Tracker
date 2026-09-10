package com.productivity.tracker

import android.annotation.SuppressLint
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var prefsListener: SharedPreferences.OnSharedPreferenceChangeListener

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Dark edge-to-edge styling matching app palette
        window.statusBarColor = Color.parseColor("#07090F")
        window.navigationBarColor = Color.parseColor("#07090F")

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#07090F"))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val url = request?.url ?: return null
                    return assetLoader.shouldInterceptRequest(url)
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    Log.d("TrackerApp", "${consoleMessage?.message()} (at ${consoleMessage?.sourceId()}:${consoleMessage?.lineNumber()})")
                    return true
                }
            }

            addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidNative")
        }

        setContentView(webView)

        // Register listener so that widget actions immediately reflect in WebView
        val prefs = getSharedPreferences(ProductivityWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            runOnUiThread {
                webView.evaluateJavascript("window.onNativeStateSync && window.onNativeStateSync()", null)
            }
        }
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)

        // Load via virtual HTTPS domain to ensure ES module scripts and local storage work without CORS
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
    }

    override fun onResume() {
        super.onResume()
        ProductivityWidgetProvider.notifyWidgetsAndSchedule(this)
        webView.post {
            webView.evaluateJavascript("window.onNativeStateSync && window.onNativeStateSync()", null)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        val prefs = getSharedPreferences(ProductivityWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
    }

    class WebAppInterface(private val context: Context) {
        private val prefs = context.getSharedPreferences(
            ProductivityWidgetProvider.PREFS_NAME,
            Context.MODE_PRIVATE
        )

        @JavascriptInterface
        fun getStateJson(): String {
            val mode = prefs.getString(ProductivityWidgetProvider.KEY_MODE, "IDLE") ?: "IDLE"
            val workMs = prefs.getLong(ProductivityWidgetProvider.KEY_WORK_MS, 0L)
            val breakMs = prefs.getLong(ProductivityWidgetProvider.KEY_BREAK_MS, 0L)
            val lastTs = prefs.getLong(ProductivityWidgetProvider.KEY_LAST_TIMESTAMP, 0L)
            val updatedAt = prefs.getLong(ProductivityWidgetProvider.KEY_UPDATED_AT, lastTs)
            val date = prefs.getString(ProductivityWidgetProvider.KEY_DATE, "") ?: ""
            val sessions = prefs.getString(ProductivityWidgetProvider.KEY_SESSIONS_JSON, "[]") ?: "[]"

            return "{\"mode\":\"$mode\",\"workMs\":$workMs,\"breakMs\":$breakMs,\"lastTimestamp\":$lastTs,\"updatedAt\":$updatedAt,\"date\":\"$date\",\"sessionsJson\":$sessions}"
        }

        @JavascriptInterface
        fun clearPendingSessions() {
            prefs.edit().putString(ProductivityWidgetProvider.KEY_SESSIONS_JSON, "[]").apply()
        }

        @JavascriptInterface
        fun getMode(): String = prefs.getString(ProductivityWidgetProvider.KEY_MODE, "IDLE") ?: "IDLE"

        @JavascriptInterface
        fun getWorkMs(): Long = prefs.getLong(ProductivityWidgetProvider.KEY_WORK_MS, 0L)

        @JavascriptInterface
        fun getBreakMs(): Long = prefs.getLong(ProductivityWidgetProvider.KEY_BREAK_MS, 0L)

        @JavascriptInterface
        fun getLastTimestamp(): Long = prefs.getLong(ProductivityWidgetProvider.KEY_LAST_TIMESTAMP, 0L)

        @JavascriptInterface
        fun syncStateJson(jsonString: String) {
            try {
                val regexMode = Regex("\"mode\"\\s*:\\s*\"([^\"]+)\"")
                val regexWork = Regex("\"workMs\"\\s*:\\s*([0-9]+)")
                val regexBreak = Regex("\"breakMs\"\\s*:\\s*([0-9]+)")
                val regexTs = Regex("\"timestamp\"\\s*:\\s*([0-9]+)")
                val regexUpdated = Regex("\"updatedAt\"\\s*:\\s*([0-9]+)")
                val regexDate = Regex("\"date\"\\s*:\\s*\"([^\"]+)\"")

                val mode = regexMode.find(jsonString)?.groupValues?.get(1) ?: "IDLE"
                val workMs = regexWork.find(jsonString)?.groupValues?.get(1)?.toLongOrNull() ?: 0L
                val breakMs = regexBreak.find(jsonString)?.groupValues?.get(1)?.toLongOrNull() ?: 0L
                val ts = regexTs.find(jsonString)?.groupValues?.get(1)?.toLongOrNull() ?: System.currentTimeMillis()
                val updatedAt = regexUpdated.find(jsonString)?.groupValues?.get(1)?.toLongOrNull() ?: System.currentTimeMillis()
                val date = regexDate.find(jsonString)?.groupValues?.get(1)

                syncStateInternal(mode, workMs, breakMs, ts, updatedAt, date)
            } catch (e: Exception) {
                Log.e("TrackerBridge", "Error parsing syncStateJson: $jsonString", e)
            }
        }

        @JavascriptInterface
        fun syncState(mode: String, workMs: Double, breakMs: Double, timestamp: Double) {
            val now = System.currentTimeMillis()
            syncStateInternal(mode, workMs.toLong(), breakMs.toLong(), timestamp.toLong(), now, null)
        }

        @JavascriptInterface
        fun syncState(mode: String, workMs: Long, breakMs: Long, timestamp: Long) {
            val now = System.currentTimeMillis()
            syncStateInternal(mode, workMs, breakMs, timestamp, now, null)
        }

        private fun syncStateInternal(
            mode: String,
            workMs: Long,
            breakMs: Long,
            timestamp: Long,
            updatedAt: Long,
            date: String?
        ) {
            val editor = prefs.edit()
                .putString(ProductivityWidgetProvider.KEY_MODE, mode)
                .putLong(ProductivityWidgetProvider.KEY_WORK_MS, workMs)
                .putLong(ProductivityWidgetProvider.KEY_BREAK_MS, breakMs)
                .putLong(ProductivityWidgetProvider.KEY_LAST_TIMESTAMP, timestamp)
                .putLong(ProductivityWidgetProvider.KEY_UPDATED_AT, updatedAt)

            if (!date.isNullOrEmpty()) {
                editor.putString(ProductivityWidgetProvider.KEY_DATE, date)
            }
            editor.apply()

            ProductivityWidgetProvider.notifyWidgetsAndSchedule(context)
        }
    }
}
