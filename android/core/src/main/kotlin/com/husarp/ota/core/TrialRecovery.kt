package com.husarp.ota.core

/** Monotonic foreground/unlocked time only; owned by one launch, survives Activity recreation. */
class TrialRecovery {
    private var token: String? = null
    private var last: Long = 0
    private var active = false
    private var elapsed = 0L
    private var waited = false
    val showLoading: Boolean get() = !waited && reason == null
    var reason: String? = null
        private set
    fun launch(value: String, now: Long) {
        if (token == value) return
        token = value; last = now; active = false; elapsed = 0; waited = false; reason = null
    }
    fun update(now: Long, eligible: Boolean, trial: Boolean): Long? {
        if (active) elapsed += (now - last).coerceAtLeast(0)
        last = now; active = eligible && trial
        if (!trial) { reason = null; return null }
        if (elapsed >= 4000 && reason == null) reason = "ready-timeout"
        return if (active && reason == null) (4000 - elapsed).coerceAtLeast(0) else null
    }
    fun failed(trial: Boolean, cause: String) {
        if (trial && reason == null) reason = cause
    }
    fun waitLonger(now: Long) { waited = true; reason = null; elapsed = 0; last = now }
}
