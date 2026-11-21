package com.husarp.ota.core

enum class CheckFailure(val message: String) {
    OFFLINE("Can't check for updates — no internet"),
    UNREACHABLE("Can't check for updates — connection blocked (firewall?)"),
    MANIFEST("Can't check for updates — signature or manifest problem")
}

class CheckException(val failure: CheckFailure, cause: Exception? = null) : Exception(failure.message, cause)

fun <Source, Manifest> verifyUpdateCheck(
    validated: () -> Boolean, fetch: () -> Source, verify: (Source) -> Manifest
): Pair<Source, Manifest> {
    if (!validated()) throw CheckException(CheckFailure.OFFLINE)
    val source = try { fetch() } catch (error: Exception) {
        val failure = when {
            error is IntegrityException -> CheckFailure.MANIFEST
            !validated() -> CheckFailure.OFFLINE
            else -> CheckFailure.UNREACHABLE
        }
        throw CheckException(failure, error)
    }
    return source to try { verify(source) } catch (error: Exception) {
        throw CheckException(CheckFailure.MANIFEST, error)
    }
}

enum class CheckChannel { WEB, SHELL }
data class CheckNotice(val channel: CheckChannel, val failure: CheckFailure)

class CheckNoticeGate {
    private val pending = linkedMapOf<CheckChannel, CheckFailure>()
    private var shown = false

    @Synchronized fun failed(channel: CheckChannel, failure: CheckFailure) {
        if (!shown) pending[channel] = failure
    }

    @Synchronized fun succeeded(channel: CheckChannel) { pending.remove(channel) }

    @Synchronized fun hasPending() = pending.isNotEmpty()

    @Synchronized fun claim(): CheckNotice? {
        val entry = pending.entries.firstOrNull() ?: return null
        val notice = CheckNotice(entry.key, entry.value)
        pending.clear()
        shown = true
        return notice
    }
}
