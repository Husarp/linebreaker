package com.husarp.ota.core

import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException
import org.junit.Assert.*
import org.junit.Test

class UpdateCheckTest {
    @Test fun noValidatedNetworkSkipsFetch() {
        val error = assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ false }, { throw AssertionError("should not fetch") }, { it })
        }
        assertEquals(CheckFailure.OFFLINE, error.failure)
    }

    @Test fun lostValidatedNetworkDuringFetchIsOffline() {
        var validated = true
        val error = assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ validated }, { validated = false; throw SocketTimeoutException() }, { it })
        }
        assertEquals(CheckFailure.OFFLINE, error.failure)
    }

    @Test fun unreachableOnValidatedNetworkIncludesHttpErrors() {
        listOf(UnknownHostException(), SSLHandshakeException("TLS"), SocketTimeoutException(),
            HttpStatusException(404), HttpStatusException(403), HttpStatusException(503)).forEach { cause ->
            val error = assertThrows(CheckException::class.java) {
                verifyUpdateCheck({ true }, { throw cause }, { it })
            }
            assertEquals(CheckFailure.UNREACHABLE, error.failure)
            assertSame(cause, error.cause)
        }
    }

    @Test fun badManifestIsDistinctFromTransportFailure() {
        assertEquals(CheckFailure.MANIFEST, assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ true }, { "unsigned" }, { error("invalid signature") })
        }.failure)
        assertEquals(CheckFailure.MANIFEST, assertThrows(CheckException::class.java) {
            verifyUpdateCheck({ true }, { throw IntegrityException("Response too large") }, { it })
        }.failure)
        assertEquals("signed" to 42, verifyUpdateCheck({ true }, { "signed" }, { 42 }))
    }

    @Test fun gameAndNativeShareOneNoticeAcrossChecksAndLaunches() {
        val gate = CheckNoticeGate()
        assertNull(gate.claim())
        gate.failed(CheckChannel.WEB, CheckFailure.OFFLINE)
        gate.failed(CheckChannel.SHELL, CheckFailure.UNREACHABLE)
        assertTrue(gate.hasPending())
        assertEquals(CheckNotice(CheckChannel.WEB, CheckFailure.OFFLINE), gate.claim())
        gate.succeeded(CheckChannel.WEB)
        gate.failed(CheckChannel.WEB, CheckFailure.MANIFEST)
        assertFalse(gate.hasPending())
        assertNull(gate.claim())
        val nextSession = CheckNoticeGate()
        nextSession.failed(CheckChannel.WEB, CheckFailure.MANIFEST)
        assertNotNull(nextSession.claim())
    }

    @Test fun successOnlyClearsItsOwnPendingFailureWithoutSpendingTheNotice() {
        val gate = CheckNoticeGate()
        gate.failed(CheckChannel.WEB, CheckFailure.OFFLINE)
        gate.failed(CheckChannel.SHELL, CheckFailure.OFFLINE)
        gate.succeeded(CheckChannel.WEB)
        gate.succeeded(CheckChannel.SHELL)
        assertNull(gate.claim())
        gate.failed(CheckChannel.SHELL, CheckFailure.MANIFEST)
        gate.succeeded(CheckChannel.WEB)
        assertEquals(CheckNotice(CheckChannel.SHELL, CheckFailure.MANIFEST), gate.claim())
    }
}
