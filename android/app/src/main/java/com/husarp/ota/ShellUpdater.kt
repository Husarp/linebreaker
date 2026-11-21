package com.husarp.ota
import com.husarp.linebreaker.BuildConfig

import android.app.PendingIntent
import android.content.*
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.husarp.ota.core.*
import com.getcapacitor.JSObject
import java.io.File
import java.io.FileOutputStream
import java.net.URI
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.zip.ZipFile

/** The APK path is independent of web checks, downloads and trial/consent state. */
class ShellUpdater(private val context: Context, private val engine: Engine,
                   private val verifier: ManifestVerifier, private val checks: UpdateChecks, private val mayInterrupt: () -> Boolean,
                   private val changed: () -> Unit, private val settings: () -> UpdateSettings, private val unmetered: () -> Boolean) {
    private val executor = Executors.newSingleThreadExecutor()
    private val transport = HttpsTransport()
    private val dir = File(engine.root,"shell").apply { mkdirs() }
    private val envelope = File(dir,"shell.json")
    private val prefs = context.getSharedPreferences("shell-install",Context.MODE_PRIVATE)
    @Volatile var status = "No shell update"
        private set
    @Volatile var lastCheckSucceeded = true
        private set
    @Volatile var downloading = false
        private set
    @Volatile internal var transfer: TransferState? = null
        private set
    @Volatile var installing = prefs.getInt("session",-1) >= 0
        private set
    @Volatile private var confirmation: Intent? = null
    @Volatile private var ready: ShellManifest? = null
    fun canInstallPackages() = context.packageManager.canRequestPackageInstalls()
    @Volatile private var installRequested = false
    @Volatile private var explicitInstallRequested = false
    private var recoveredAtStart = false
    private var permissionOpened = false
    fun isReady() = ready != null && (!installing || confirmation != null)
    fun manifest() = ready
    private fun log(text: String, start: Long = System.nanoTime()) {
        engine.log.add("Shell: $text",(System.nanoTime()-start)/1_000_000); changed()
    }
    private fun verifyStored(): ShellManifest? = if (envelope.isFile) runCatching {
        verifier.verifyShell(envelope.readBytes(),System.currentTimeMillis(),BuildConfig.VERSION_CODE.toLong())
    }.getOrNull() else null
    @Volatile private var available: ShellManifest? = null
    fun state(m: ShellManifest): JSObject = JSObject(json.toJson(engine.dates.get("shell", m.versionCode.toString())))
        .put("releasedAt",m.releasedAt).put("version",m.versionName).put("size",m.size).put("versionCode",m.versionCode)
    fun availableState(): JSObject? = available?.let { state(it) }
    fun check(consent: Boolean = false, manual: Boolean = false): Future<*> = executor.submit {
        if (!consent && !manual && !settings().automaticChecks) return@submit
        val start = System.nanoTime()
        lastCheckSucceeded = false
        try {
            val firstCheck = !recoveredAtStart
            recoveredAtStart = true
            // Recover publication metadata even when this envelope now describes the running APK.
            if (envelope.isFile) runCatching {
                val stored = verifier.verifyShell(envelope.readBytes(),System.currentTimeMillis(),-1)
                engine.dates.record("shell",stored.versionCode.toString(),stored.releasedAt)
            }
            recordInstalledIfNeeded()
            // Recover a ready APK and a pending system confirmation after process death.
            ready = verifyStored()?.takeIf { File(dir,it.apk).isFile }
            if (ready != null) {
                verifyApk(File(dir,ready!!.apk),ready!!)
                engine.dates.record("shell",ready!!.versionCode.toString(),ready!!.releasedAt,downloaded=true)
                val id=prefs.getInt("session",-1)
                val installer=context.packageManager.packageInstaller
                val lostConfirmation=prefs.getBoolean("awaitingConfirmation",false) && confirmation==null
                if (id >= 0 && (installer.getSessionInfo(id) == null || lostConfirmation)) {
                    if(lostConfirmation) { runCatching { installer.abandonSession(id) }; log("process restarted while confirmation pending; regenerate session safely") }
                    installing=false; prefs.edit().remove("session").putBoolean("awaitingConfirmation",false).apply(); confirmation=null
                }
                // A retained APK may ask Android at the next app start. A background
                // worker cannot open Android UI; foreground resume handles that part.
                if (firstCheck && automaticShellInstall(settings())) { installRequested = true; prefs.edit().putBoolean("failed",false).apply() }
                maybeInstallOnExecutor()
            } else {
                confirmation=null
                val old = prefs.getInt("session",-1)
                if (old >= 0) runCatching { context.packageManager.packageInstaller.abandonSession(old) }
                prefs.edit().remove("session").apply(); installing=false
            }
            log("check started; installed versionCode ${BuildConfig.VERSION_CODE}")
            val (source, m) = checks.fetch(CheckChannel.SHELL, Updater.SHELL_URL, transport) {
                verifier.verifyShell(it.bytes,System.currentTimeMillis(),-1)
            }
            engine.dates.record("shell",m.versionCode.toString(),m.releasedAt,
                available=m.versionCode>BuildConfig.VERSION_CODE)
            lastCheckSucceeded=true
            if(m.versionCode<=BuildConfig.VERSION_CODE) {
                log("decision: equal/older shell ${m.versionCode}; skip")
                if(ready==null) status="Shell is current"
                return@submit
            }
            log("signature OK; versionCode ${m.versionCode}, API ${m.shellApi}, embedded ${m.embeddedWebVersion}")
            if (ready?.sha256 == m.sha256 && ready?.versionCode == m.versionCode) { log("already ready/session pending"); return@submit }
            // Do not replace an APK while a committed installer session is using it.
            if (installing) { log("existing session pending; defer new shell download"); return@submit }
            available = m
            if (!consent && !automaticDownload(settings(),"shell",m.size,unmetered())) {
                status="App update ${m.versionName} · ${m.size} bytes · Later / Update"; changed(); return@submit
            }
            transfer=TransferState(0,m.size,0); downloading=true; status="Downloading app ${m.versionName}"; changed()
            val apk=download(m,consent)
            verifyApk(apk,m)
            engine.dates.record("shell",m.versionCode.toString(),m.releasedAt,downloaded=true)
            atomicWrite(envelope,source.bytes); ready=m; available=null; installRequested=consent || automaticShellInstall(settings()); explicitInstallRequested=consent
            // Update tapped: install right after the download, no second tap.
            if (consent) prefs.edit().putInt("notifyTarget",m.versionCode.toInt()).commit()
            dir.listFiles()?.filter { it.name.endsWith(".apk") && it.name != m.apk }?.forEach { it.delete() }
            status="App update ${ready?.versionName ?: BuildConfig.VERSION_NAME} ready · Install"; log("APK staged ${m.apk}",start)
            maybeInstallOnExecutor()
        } catch(e: Exception) {
            lastCheckSucceeded=false
            status=if (e is CheckException) e.failure.message else "Shell update processing failed: ${e.message}"
            log("failed: ${e.javaClass.simpleName}: ${e.message}",start)
        } finally { downloading=false; changed(); log("check finished",start) }
    }
    private fun download(m: ShellManifest, consent: Boolean): File {
        require(dir.usableSpace >= m.size*2) { "Not enough APK storage" }
        val target=File(dir,m.apk)
        if (target.isFile && target.length()==m.size && hash(target)==m.sha256) return target
        val part=File(dir,"${m.apk}.${m.sha256}.part")
        if (part.length()>m.size) part.delete()
        var offset=part.length(); var received=0L
        val start=System.nanoTime()
        if(!consent) require(automaticDownload(settings(),"shell",m.size,unmetered())) { "Automatic APK download paused; Later / Update" }
        transport.open(URI(Updater.SHELL_URL).resolve(m.apk).toString(),offset).use { r ->
            if(r.status==206) require(r.rangeStart==offset) { "APK Range mismatch" }
            else { require(r.status==200); offset=0 }
            FileOutputStream(part,offset>0).use { out ->
                val buffer=ByteArray(65536); var last=0L
                while(true) {
                    if(!consent) require(automaticDownload(settings(),"shell",m.size,unmetered())) { "Automatic APK download paused; Later / Update" }
                    val n=r.body.read(buffer); if(n<0) break
                    require(offset+received+n<=m.size) { "APK oversized" }
                    out.write(buffer,0,n); received+=n
                    val ms=(System.nanoTime()-start)/1_000_000
                    if(ms-last>=500) {
                        transfer=TransferState(offset+received,m.size,received*1000/ms.coerceAtLeast(1))
                        status="Downloading app ${m.versionName}"; changed(); last=ms
                    }
                }
                out.fd.sync()
            }
        }
        require(part.length()==m.size) { "APK incomplete; partial saved for retry" }
        if(hash(part)!=m.sha256) { part.delete(); error("APK SHA-256 mismatch") }
        target.delete(); kotlin.check(part.renameTo(target)); syncDirectory(dir)
        val speed = received*1000/((System.nanoTime()-start)/1_000_000).coerceAtLeast(1)
        log("APK downloaded $received bytes at $speed B/s; SHA-256 OK",start)
        return target
    }
    @Suppress("DEPRECATION")
    private fun packageInfo(path: String?): PackageInfo {
        val flags=if(Build.VERSION.SDK_INT>=28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        return (if(path==null) context.packageManager.getPackageInfo(context.packageName,flags)
            else context.packageManager.getPackageArchiveInfo(path,flags)) ?: error("Cannot parse APK")
    }
    @Suppress("DEPRECATION")
    private fun certs(info: PackageInfo): Set<String> =
        (if(Build.VERSION.SDK_INT>=28) info.signingInfo?.apkContentsSigners else info.signatures)
            ?.map { hash(it.toByteArray()) }?.toSet()?.takeIf { it.isNotEmpty() } ?: error("APK missing signer")
    @Suppress("DEPRECATION")
    private fun verifyApk(apk: File, m: ShellManifest) {
        val start=System.nanoTime()
        require(apk.length()==m.size && hash(apk)==m.sha256) { "APK SHA-256/size mismatch" }
        val archive=packageInfo(apk.absolutePath)
        val code=if(Build.VERSION.SDK_INT>=28) archive.longVersionCode else archive.versionCode.toLong()
        require(archive.packageName==context.packageName && code==m.versionCode && archive.versionName==m.versionName) { "APK identity/version mismatch" }
        require(certs(archive)==certs(packageInfo(null))) { "APK signing certificate differs from running app" }
        ZipFile(apk).use { zip ->
            val entry=zip.getEntry("assets/embedded-manifest.json") ?: error("APK lacks embedded manifest")
            val embedded=zip.getInputStream(entry).use { json.fromJson(it.readBytesLimited(2*1024*1024).toString(Charsets.UTF_8),Manifest::class.java) }
            validateManifest(embedded); require(embedded.version==m.embeddedWebVersion) { "APK embedded version mismatch" }
        }
        log("APK SHA-256, package/version, signing certificate and embedded version verified",start)
    }
    fun maybeInstall() { executor.execute { runCatching { maybeInstallOnExecutor() }.onFailure { status="Install failed: ${it.message}"; log("failed: ${it.message}") } } }
    private fun maybeInstallOnExecutor() {
        val m=ready ?: return
        if (!explicitInstallRequested && !automaticShellInstall(settings())) { log("automatic shell installation disabled"); return }
        if (!mayInterrupt()) { log("install deferred: busy in round"); return }
        if (prefs.getBoolean("failed",false)) return
        if (installing || confirmation!=null) { changed(); return }
        if (!canInstallPackages()) { status="App update ${m.versionName} ready · allow Install unknown apps"; log("unknown-app permission needed"); return }
        val start=System.nanoTime()
        verifier.verifyShell(envelope.readBytes(),System.currentTimeMillis(),BuildConfig.VERSION_CODE.toLong())
        val apk=File(dir,m.apk); verifyApk(apk,m)
        val installer=context.packageManager.packageInstaller
        val params=PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName); setSize(m.size)
            if(Build.VERSION.SDK_INT>=31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val id=installer.createSession(params)
        try {
            installer.openSession(id).use { session ->
                session.openWrite(m.apk,0,m.size).use { out -> apk.inputStream().use { it.copyTo(out) }; session.fsync(out) }
                val intent=Intent(context,InstallStatusReceiver::class.java).setAction("${context.packageName}.INSTALL_RESULT").putExtra("sessionId",id)
                val flags=PendingIntent.FLAG_UPDATE_CURRENT or (if(Build.VERSION.SDK_INT>=31) PendingIntent.FLAG_MUTABLE else 0)
                val receiver=PendingIntent.getBroadcast(context,id,intent,flags)
                if(!mayInterrupt() || (!explicitInstallRequested && !automaticShellInstall(settings()))) {
                    installer.abandonSession(id); log("session deferred before commit: busy in round"); return
                }
                // Durable before commit: package replacement can terminate this process immediately.
                kotlin.check(prefs.edit().putInt("session",id).putInt("targetCode",m.versionCode.toInt()).putBoolean("confirmationShown",false).putBoolean("awaitingConfirmation",false).putBoolean("failed",false).commit())
                installing=true; status="Installing app ${m.versionName}"
                session.commit(receiver.intentSender)
                log("session $id committed; user action not required requested (platform decides)",start)
            }
        } catch(e: Exception) { installer.abandonSession(id); installing=false; prefs.edit().remove("session").remove("notifyTarget").apply(); throw e }
    }
    fun presentRequestedAndroidUi(activity: MainActivity) {
        if (!installRequested || (!explicitInstallRequested && !automaticShellInstall(settings())) || !mayInterrupt() || !isReady()) return
        if (!canInstallPackages() && !permissionOpened) {
            permissionOpened = true
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:${context.packageName}")))
        } else if (canInstallPackages() && confirmation != null && !prefs.getBoolean("confirmationShown",false)) {
            installFromWeb(activity, false)
        }
    }
    fun installFromWeb(activity: MainActivity, userInitiated: Boolean = true) {
        if (!mayInterrupt() || !isReady()) return
        installRequested = true
        if(userInitiated) {
            explicitInstallRequested = true
            ready?.let { prefs.edit().putInt("notifyTarget",it.versionCode.toInt()).commit() }
        }
        permissionOpened = false
        prefs.edit().putBoolean("failed",false).apply()
        if(!canInstallPackages()) {
            permissionOpened = true
            log("opening Android Install unknown apps settings")
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:${context.packageName}")))
        } else confirmation?.let {
            prefs.edit().putBoolean("confirmationShown",true).apply()
            log("user confirmation: launching Android installer once")
            try { activity.startActivity(it) } catch(e: Exception) { log("failed opening confirmation: ${e.message}") }
        } ?: maybeInstall()
    }
    private fun recordInstalledIfNeeded(): Boolean {
        val target=prefs.getInt("targetCode",-1)
        if(target<1 || target>BuildConfig.VERSION_CODE) return false
        val path=if(prefs.getBoolean("confirmationShown",false)) "user confirmation" else "silent"
        runCatching {
            val installed = verifier.verifyShell(envelope.readBytes(),System.currentTimeMillis(),-1)
            if (installed.versionCode == BuildConfig.VERSION_CODE.toLong()) {
                prefs.edit().putInt("notesCode", BuildConfig.VERSION_CODE).putString("notes", installed.notes).apply()
            }
        }
        status="App updated (${BuildConfig.VERSION_NAME})"; log("install success ($path); observed installed code ${BuildConfig.VERSION_CODE}")
        clearSession(); ready=null; envelope.delete(); return true
    }
    fun installedNotes(): String? = prefs.getString("notes",null).takeIf { prefs.getInt("notesCode",-1) == BuildConfig.VERSION_CODE }
    fun packageReplaced() {
        ShellUpdatedNotification.postIfRequested(context)
        if(!recordInstalledIfNeeded()) log("package replacement observed: installed ${BuildConfig.VERSION_CODE}")
    }
    fun result(intent: Intent) {
        val id=intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID,intent.getIntExtra("sessionId",-1))
        if (id!=prefs.getInt("session",-2)) { log("ignored stale session callback $id"); return }
        when(val code=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION") val next=intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if(next==null) { log("failed: confirmation Intent missing"); return }
                confirmation=next
                prefs.edit().putBoolean("awaitingConfirmation",true).apply()
                status="App update ${ready?.versionName ?: BuildConfig.VERSION_NAME} ready · Install"; log("user confirmation required by Android; wait for web Install action or next start")
            }
            PackageInstaller.STATUS_SUCCESS -> {
                val path=if(prefs.getBoolean("confirmationShown",false)) "user confirmation" else "silent"
                status="App updated (${ready?.versionName ?: BuildConfig.VERSION_NAME})"; log("install success ($path)"); clearSession()
                ready=null; envelope.delete()
            }
            else -> { prefs.edit().remove("notifyTarget").putBoolean("failed",true).apply(); status="App install failed ($code)"; log("failed ($code): ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)}"); clearSession() }
        }
        changed()
    }
    private fun clearSession() { installing=false; confirmation=null; prefs.edit().remove("session").remove("targetCode").putBoolean("awaitingConfirmation",false).apply() }
}

class InstallStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val shell=(context.applicationContext as OtaApplication).updater.shell
        if(intent.action==Intent.ACTION_MY_PACKAGE_REPLACED) shell.packageReplaced() else shell.result(intent)
    }
}
