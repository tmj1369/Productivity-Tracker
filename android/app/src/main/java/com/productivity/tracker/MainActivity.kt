package com.productivity.tracker

import android.annotation.SuppressLint
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
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

        // Load via virtual HTTPS domain to ensure ES module scripts and local storage work without CORS
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
    }

    override fun onResume() {
        super.onResume()
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
        fun getStateJson(): String {
            val mode = prefs.getString(ProductivityWidgetProvider.KEY_MODE, "IDLE") ?: "IDLE"
            val workMs = prefs.getLong(ProductivityWidgetProvider.KEY_WORK_MS, 0L)
            val breakMs = prefs.getLong(ProductivityWidgetProvider.KEY_BREAK_MS, 0L)
            val lastTs = prefs.getLong(ProductivityWidgetProvider.KEY_LAST_TIMESTAMP, 0L)
            return "{\"mode\":\"$mode\",\"workMs\":$workMs,\"breakMs\":$breakMs,\"lastTimestamp\":$lastTs}"
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

                val mode = regexMode.find(jsonString)?.groupValues?.get(1) ?: "IDLE"
                val workMs = regexWork.find(jsonString)?.groupValues?.get(1)?.toLongOrNull() ?: 0L
                val breakMs = regexBreak.find(jsonString)?.groupValues?.get(1)?.toLongOrNull() ?: 0L
                val ts = regexTs.find(jsonString)?.groupValues?.get(1)?.toLongOrNull() ?: System.currentTimeMillis()

                syncStateInternal(mode, workMs, breakMs, ts)
            } catch (e: Exception) {
                Log.e("TrackerBridge", "Error parsing syncStateJson: $jsonString", e)
            }
        }

        @JavascriptInterface
        fun syncState(mode: String, workMs: Double, breakMs: Double, timestamp: Double) {
            syncStateInternal(mode, workMs.toLong(), breakMs.toLong(), timestamp.toLong())
        }

        @JavascriptInterface
        fun syncState(mode: String, workMs: Long, breakMs: Long, timestamp: Long) {
            syncStateInternal(mode, workMs, breakMs, timestamp)
        }

        private fun syncStateInternal(mode: String, workMs: Long, breakMs: Long, timestamp: Long) {
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
