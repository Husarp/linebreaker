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
import com.husarp.linebreaker.BuildConfig
import com.husarp.linebreaker.R

object ShellUpdatedNotification {
    fun enabled(context: Context) = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
        .getString("linebreaker-update-notifications", null) == "on"

    fun postIfRequested(context: Context) {
        val prefs=context.getSharedPreferences("shell-install",Context.MODE_PRIVATE)
        val target=prefs.getInt("notifyTarget",-1)
        // Consume independently of installer callbacks/session cleanup; never repeat on a later replacement.
        if (!prefs.edit().remove("notifyTarget").commit()) return
        if (!shellUpdatedNoticeRequested(target,BuildConfig.VERSION_CODE)) return
        if (!enabled(context)) return
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val manager=context.getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return
        manager.createNotificationChannel(NotificationChannel("shell-updated","App update completed",NotificationManager.IMPORTANCE_DEFAULT))
        val open=PendingIntent.getActivity(context,0,Intent(context,MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notice=Notification.Builder(context,"shell-updated")
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("${context.getString(R.string.app_name)} updated · tap to open")
            .setContentText("Shell updated to version ${BuildConfig.VERSION_NAME}")
            .setContentIntent(open).setAutoCancel(true).build()
        // Permission can be revoked between the check and notify.
        try { manager.notify(701,notice) } catch (_: SecurityException) { }
    }
}
