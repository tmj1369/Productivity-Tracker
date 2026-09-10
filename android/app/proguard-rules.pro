# Proguard rules for Productivity Tracker
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class androidx.webkit.** { *; }
-keep class com.productivity.tracker.** { *; }
