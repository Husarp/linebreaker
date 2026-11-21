package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*

class TrialRecoveryTest {
    @Test fun fourSecondsCountsOnlyForegroundUnlockedTime() {
        val r = TrialRecovery(); r.launch("a",0)
        assertTrue(r.showLoading)
        assertEquals(4000L,r.update(0,true,true))
        assertEquals(2000L,r.update(2000,true,true))
        assertNull(r.update(3000,false,true))
        assertNull(r.update(100000,false,true)); assertNull(r.reason)
        assertEquals(1000L,r.update(100000,true,true))
        assertEquals(1L,r.update(100999,true,true)); assertTrue(r.showLoading)
        r.update(101000,true,true); assertEquals("ready-timeout",r.reason)
        assertFalse(r.showLoading)
    }
    @Test fun uncaughtAndLoadErrorsTriggerImmediatelyOnlyDuringTrial() {
        for (cause in listOf("javascript-error","load-error")) {
            val r = TrialRecovery(); r.launch("a",0)
            r.failed(false,cause); assertNull(r.reason)
            r.failed(true,cause); assertEquals(cause,r.reason); assertFalse(r.showLoading)
            r.update(10,false,true); assertEquals(cause,r.reason) // held for resume
            r.update(20,true,false); assertNull(r.reason)
        }
    }
    @Test fun waitHidesLoadingAndRestartsFourSecondTimerIncludingPauseAndRecreation() {
        val r=TrialRecovery();r.launch("a",0);r.update(0,true,true)
        r.update(4000,true,true);assertEquals("ready-timeout",r.reason)
        r.waitLonger(4500);assertNull(r.reason);assertFalse(r.showLoading)
        assertEquals(4000L,r.update(4500,true,true))
        r.update(5500,false,true)
        r.launch("a",100000) // same launch must retain Wait and remaining time
        assertEquals(3000L,r.update(100000,true,true));assertFalse(r.showLoading)
        assertEquals(1L,r.update(102999,true,true))
        r.update(103000,true,true);assertEquals("ready-timeout",r.reason)
        r.waitLonger(103000);r.update(103000,true,true)
        r.failed(true,"javascript-error");assertEquals("javascript-error",r.reason)
        r.launch("b",104000);assertTrue(r.showLoading);assertNull(r.reason)
        assertEquals(4000L,r.update(104000,true,true))
    }
    @Test fun readinessCancelsInitialAndWaitTimersAndExistingErrors() {
        for (wait in listOf(false,true)) {
            val r=TrialRecovery();r.launch("a",0);r.update(0,true,true)
            r.failed(true,"load-error")
            if(wait) r.waitLonger(1000)
            assertNull(r.update(2000,true,false));assertNull(r.reason)
            assertNull(r.update(90000,true,false));assertNull(r.reason)
            r.failed(false,"javascript-error");assertNull(r.reason)
        }
    }
    @Test fun goBackIsImmediateDurableAndNeverOffersFailedVersionAgain() {
        val h=Harness();h.good("1.1.0");h.pending("1.2.0");val l=h.engine.coldStart()
        assertEquals("1.1.0",h.engine.recoveryTarget())
        assertFalse(h.engine.recover(l.version,"stale","ready-timeout"))
        assertTrue(h.engine.recover(l.version,l.token,"ready-timeout"))
        assertFalse(h.engine.recover(l.version,l.token,"ready-timeout"))
        val next=Harness(h.root);val recovered=next.engine.coldStart()
        assertEquals("1.1.0",recovered.version);assertTrue("1.2.0" in next.engine.snapshot().failed)
        expectFailure { next.pending("1.2.0") }
        val m=bundle("1.2.0")
        assertEquals(Action.REJECT,decide(m,next.engine.currentManifest(),next.embedded,1,UpdateSettings(),true,next.engine.snapshot().failed,emptyList(),false,null).action)
    }
    @Test fun noPreviousGoodBundleUsesEmbedded() {
        val h=Harness();h.pending("1.1.0");val l=h.engine.coldStart()
        assertEquals("1.0.0",h.engine.recoveryTarget())
        h.engine.recover(l.version,l.token,"javascript-error")
        assertEquals("1.0.0",h.engine.coldStart().version)
    }
    @Test fun automaticRollbackNoticeSurvivesProcessAndIsClaimedOnceAfterReady() {
        val h=Harness();h.pending("1.1.0");h.engine.coldStart();h.engine.coldStart()
        h.engine.coldStart() // two failed starts retained as safety net
        val next=Harness(h.root);val l=next.engine.coldStart()
        assertNull(next.engine.takeRollbackNotice(l.version,"stale"))
        next.engine.ready(l.version,l.token)
        val n=next.engine.takeRollbackNotice(l.version,l.token)!!
        assertEquals(RollbackNotice("1.1.0","1.0.0","failed-starts"),n)
        assertNull(next.engine.takeRollbackNotice(l.version,l.token))
        assertNull(next.engine.takeUpdatedNotice(l.version,l.token))
        val again=Harness(h.root);val a=again.engine.coldStart();again.engine.ready(a.version,a.token)
        assertNull(again.engine.takeRollbackNotice(a.version,a.token))
    }
    @Test fun manualRollbackNoticePreservesCauseAndCannotBeClaimedByFailedPage() {
        val h=Harness();h.pending("1.1.0");val l=h.engine.coldStart()
        assertNull(h.engine.takeRollbackNotice(l.version,l.token))
        h.engine.recover(l.version,l.token,"load-error")
        assertNull(h.engine.takeRollbackNotice(l.version,l.token))
        val a=h.engine.coldStart();h.engine.ready(a.version,a.token)
        assertEquals("load-error",h.engine.takeRollbackNotice(a.version,a.token)!!.reason)
    }
}
