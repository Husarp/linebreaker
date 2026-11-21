package com.husarp.ota

import android.content.Context
import android.net.ConnectivityManager
import com.getcapacitor.JSObject
import com.husarp.ota.core.*
import java.text.DateFormat
import java.util.Date

class UpdateChecks(context: Context, private val log: EventLog, private val changed: () -> Unit) {
    private val prefs = context.getSharedPreferences("ota-checks", Context.MODE_PRIVATE)
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)
    private val gate = CheckNoticeGate()

    private fun connected() = connectivity.activeNetwork != null

    fun <Manifest> fetch(channel: CheckChannel, url: String, transport: Transport,
                         verify: (DownloadedManifest) -> Manifest): Pair<DownloadedManifest, Manifest> =
        checked(channel, { checkNotNull(fetchManifest(url, transport, log, allowMissing = false)) }, verify)

    fun <Manifest> fetchShell(url: String, transport: Transport, verify: (DownloadedManifest) -> Manifest): Pair<DownloadedManifest, Manifest>? {
        val (source, manifest) = checked(CheckChannel.SHELL, { fetchManifest(url, transport, log) }) { it?.let(verify) }
        return if (source != null && manifest != null) source to manifest else null
    }

    private fun <Source, Manifest> checked(channel: CheckChannel, fetch: () -> Source, verify: (Source) -> Manifest): Pair<Source, Manifest> {
        val result = try {
            verifyUpdateCheck(::connected, fetch, verify)
        } catch (error: CheckException) {
            failure(channel, error)
            throw error
        }
        success(channel)
        return result
    }

    @Synchronized private fun failure(channel: CheckChannel, error: CheckException) {
        prefs.edit().putString("$channel.error", error.failure.name).apply()
        gate.failed(channel, error.failure)
        log.add("$channel: ${error.failure.message}${error.cause?.message?.let { ": $it" }.orEmpty()}")
        changed()
    }

    @Synchronized private fun success(channel: CheckChannel) {
        prefs.edit().putLong("$channel.success", System.currentTimeMillis()).remove("$channel.error").apply()
        gate.succeeded(channel)
        changed()
    }

    fun claim() = gate.claim()
    fun hasError() = CheckChannel.entries.any { error(it) != null }

    private fun error(channel: CheckChannel) = prefs.getString("$channel.error", null)?.let { name ->
        CheckFailure.entries.find { it.name == name }?.message
    }

    fun summary(): String = error(CheckChannel.WEB) ?: error(CheckChannel.SHELL) ?: run {
        val last = CheckChannel.entries.maxOf { prefs.getLong("$it.success", 0) }
        if (last == 0L) "Last checked: never" else "Last checked: ${DateFormat.getDateTimeInstance().format(Date(last))}"
    }

    fun snapshot() = JSObject().apply {
        for (channel in CheckChannel.entries) put(channel.name.lowercase(), JSObject()
            .put("lastSuccessAt", prefs.getLong("$channel.success", 0)).put("error", error(channel)))
        put("summary", summary())
        put("failed", hasError())
        put("noticePending", gate.hasPending())
    }
}
