package com.husarp.ota

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.husarp.ota.core.shellUpdatedNoticeRequested
import com.husarp.ota.core.UpdateNotificationGate
import com.husarp.linebreaker.BuildConfig
import com.husarp.linebreaker.R

object ShellUpdatedNotification {
    private val gate = UpdateNotificationGate()
    private val ids = listOf(701, 15401, 15402, 15403)

    fun enterForeground(context: Context) = gate.enter {
        val manager = context.getSystemService(NotificationManager::class.java)
        ids.forEach { manager.cancel(it) }
    }

    fun leaveForeground() = gate.leave()

    fun enabled(context: Context) = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
        .getString("linebreaker-update-notifications", null) == "on"

    fun postIfRequested(context: Context) {
        val prefs=context.getSharedPreferences("shell-install",Context.MODE_PRIVATE)
        val target=prefs.getInt("notifyTarget",-1)
        // Consume independently of installer callbacks/session cleanup; never repeat on a later replacement.
        if (!prefs.edit().remove("notifyTarget").commit()) return
        if (!shellUpdatedNoticeRequested(target,BuildConfig.VERSION_CODE)) return
        post(context, 701, "Update installed", "Linebreaker is now on version ${BuildConfig.VERSION_NAME}.")
    }

    fun postWorkerOffers(context: Context, updater: Updater) {
        val state = updater.info()
        val prefs = context.getSharedPreferences("worker-update-notices", Context.MODE_PRIVATE)
        listOf(Triple(15401, "staged", "available"), Triple(15402, "shellReady", "shellAvailable")).forEach { (id, readyKey, offerKey) ->
            val ready = state.optJSONObject(readyKey)
            val offer = ready ?: state.optJSONObject(offerKey)
            val version = offer?.optString("version")?.takeIf { it.isNotBlank() } ?: return@forEach
            val key = "$id:$version:${ready != null}"
            val title = if (id == 15402) "App update" else "Update"
            post(context, id, "$title ${if (ready != null) "ready" else "available"}",
                "Open Linebreaker to see version $version.", prefs = prefs, key = key)
        }
    }

    private fun post(context: Context, id: Int, title: String, text: String,
        prefs: android.content.SharedPreferences? = null, key: String? = null) = gate.postInBackground {
        if (!enabled(context) || (key != null && prefs?.getString(id.toString(), null) == key)) return@postInBackground
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return@postInBackground
        val manager=context.getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return@postInBackground
        val channel = "linebreaker-updates"
        manager.createNotificationChannel(NotificationChannel(channel,"Linebreaker updates",NotificationManager.IMPORTANCE_DEFAULT))
        val open=PendingIntent.getActivity(context,0,Intent(context,MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notice=Notification.Builder(context,channel)
            .setSmallIcon(R.drawable.ic_stat_linebreaker)
            .setColor(context.getColor(R.color.notification_accent))
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open).setAutoCancel(true).build()
        // Permission can be revoked between the check and notify.
        try {
            manager.notify(id,notice)
            if (key != null) prefs?.edit()?.putString(id.toString(), key)?.apply()
        } catch (_: SecurityException) { }
    }
}
