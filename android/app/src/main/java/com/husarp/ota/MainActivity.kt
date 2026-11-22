package com.husarp.ota

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Rect
import android.net.Uri
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.app.KeyguardManager
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.webkit.*
import com.getcapacitor.BridgeWebChromeClient
import com.getcapacitor.BridgeWebViewClient
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.view.View
import android.view.WindowManager
import android.widget.*
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.BridgeActivity
import com.getcapacitor.ProcessedRoute
import com.husarp.ota.core.*
import com.husarp.linebreaker.BuildConfig
import com.husarp.linebreaker.R
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : BridgeActivity() {
    private val updater get() = (application as OtaApplication).updater
    private val handler = Handler(Looper.getMainLooper())
    private var resumed = false
    private val ledger get() = NativeLedger.context(this)
    private var recoveryDialog: AlertDialog? = null
    private var refreshRecoveryCheck: (() -> Unit)? = null
    private var updateBanner: NativeUpdateBanner? = null
    private var maintenanceBanner: NativeUpdateBanner? = null
    private var activeBannerKey: String? = null
    private val transientBanners = mutableListOf<UpdateBannerItem>()
    private var applyingStartupFix = false
    private lateinit var activityLaunchToken: String
    private var loadingOverlay: View? = null
    private var safeArea = Insets.NONE
    private var systemTop = 0
    private var cutoutRects = emptyList<Rect>()
    private val recoveryTick = Runnable { refreshRecovery() }
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) { refreshRecovery() }
    }
    private fun refreshRecovery() {
        handler.removeCallbacks(recoveryTick)
        if (activityLaunchToken != updater.launch.token) return
        val trial = updater.engine.snapshot().trial
        val awake = (getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive &&
            !(getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
        val delay = updater.watchdog.update(SystemClock.elapsedRealtime(), resumed && awake)
        val reason = updater.watchdog.reason
        loadingOverlay?.visibility = if (trial && updater.watchdog.showLoading) View.VISIBLE else View.GONE
        if (reason == null && !applyingStartupFix) recoveryDialog?.dismiss()
        if (resumed && awake && reason != null && recoveryDialog == null && debugDialog == null &&
            logDialog == null && !isFinishing && !isDestroyed) showStartupRecovery(reason)
        if (resumed && awake) {
            refreshRecoveryCheck?.invoke()
        }
        if (delay != null) handler.postDelayed(recoveryTick, delay.coerceAtLeast(1))
    }
    private fun showStartupRecovery(reason: String) {
        updater.engine.log.add("Startup watchdog: ${updater.launch.version} ($reason)")
        val theme = ledger
        val box = LinearLayout(theme).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,12.dp,20.dp,12.dp) }
        val dialog = NativeLedger.dialog(theme, "Linebreaker didn't start properly", warning = true)
            .setView(ScrollView(theme).apply { addView(box) }).setCancelable(false).create()
        val status = TextView(theme).apply {
            text = "You can check for a fix without opening the game. Your saves stay."
            setTextColor(theme.getColor(R.color.lb_ledger_ink))
            setPadding(0, 0, 0, 12.dp)
        }
        val check = Button(theme).apply { text = "Check for fix" }
        val reset = Button(theme).apply {
            text = "Reset to built-in version"
            setTextColor(ColorStateList(
                arrayOf(intArrayOf(-android.R.attr.state_enabled), intArrayOf()),
                intArrayOf(theme.getColor(R.color.lb_ledger_muted), theme.getColor(R.color.lb_ledger_danger))
            ))
        }
        val wait = Button(theme).apply { text = "Wait longer" }
        val shell = Button(theme).apply { text = "Open app shell" }
        val copy = Button(theme).apply { text = "Copy logs"; setOnClickListener { copyLogs() } }
        val alternatives = listOf(reset, wait, shell)
        var fix: Updater.StartupFix? = null
        var retryShell = false
        refreshRecoveryCheck = {
            if (check.isEnabled && fix == null && !applyingStartupFix) updater.checks.claim()?.let {
                status.text = it.failure.message
                check.text = "Retry"
                retryShell = it.channel == CheckChannel.SHELL
            }
        }
        check.setOnClickListener {
            val selected = fix
            check.isEnabled = false
            if (selected == null) {
                if (retryShell) { updater.retryCheck(CheckChannel.SHELL); retryShell = false }
                status.text = "Checking for a fix…"
                updater.checkForStartupFix { candidate, message, failedCheck ->
                    if (recoveryDialog === dialog && !isDestroyed) {
                        if (failedCheck) updater.checks.claim()
                        fix = candidate
                        status.text = message
                        check.text = when {
                            failedCheck -> "Retry"
                            candidate == null -> "Check for fix"
                            candidate.staged -> "Apply fix and restart"
                            else -> "Download fix and restart"
                        }
                        check.isEnabled = true
                    }
                }
            } else {
                applyingStartupFix = true
                alternatives.forEach { it.isEnabled = false }
                status.text = "Applying the fix…"
                updater.applyStartupFix(selected) { error ->
                    if (!isDestroyed && !isFinishing) {
                        if (error == null) recreateBundle()
                        else if (recoveryDialog === dialog) {
                            applyingStartupFix = false; fix = null
                            status.text = error; check.text = "Check for fix"; check.isEnabled = true
                            alternatives.forEach { it.isEnabled = true }
                            refreshRecovery()
                        }
                    }
                }
            }
        }
        reset.setOnClickListener { confirmReset(startupRecovery = true) }
        wait.setOnClickListener {
            updater.watchdog.waitLonger(SystemClock.elapsedRealtime()); dialog.dismiss(); refreshRecovery()
        }
        shell.setOnClickListener { showSettings(); dialog.dismiss() }
        box.addView(status); box.addView(check)
        if (updater.launch.version != updater.engine.embedded.version) box.addView(reset)
        box.addView(wait); box.addView(shell)
        box.addView(copy)
        updateBanner?.clear()
        dialog.setOnDismissListener {
            if (recoveryDialog === dialog) { recoveryDialog = null; refreshRecoveryCheck = null }
        }
        recoveryDialog = dialog; dialog.show()
    }
    private fun startupFailed(reason: String) {
        updater.watchdog.failed(activityLaunchToken, reason)
        refreshRecovery()
    }
    private var logDialog: AlertDialog? = null
    private var logText: TextView? = null
    private val refreshLogs = object : Runnable {
        override fun run() {
            if (logDialog?.isShowing == true) { renderLogs(); handler.postDelayed(this, 1000) }
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        ShellUpdatedNotification.enterForeground(this)
        updater.prepareLaunch()
        activityLaunchToken = updater.launch.token
        registerPlugin(OtaPlugin::class.java)
        // Capacitor's own shouldInterceptRequest still injects its bridge into HTML.
        // Route every signed web path independently to the overlay or the APK asset.
        bridgeBuilder.setRouteProcessor { _, route ->
            val path = route.trimStart('/').ifEmpty { "index.html" }
            val overlay = updater.engine.overlayFile(path)
            ProcessedRoute().apply {
                setPath(if (!updater.engine.hasPath(path)) "public/__missing__" else overlay?.absolutePath ?: "public/$path")
                setAsset(overlay == null); setIgnoreAssetPath(true)
            }
        }
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val web = bridge.webView
        setupEdgeToEdge(web)
        configureSystemBars()
        // Keep Capacitor routing and browser features while catching failures independently of bundle JS.
        web.webChromeClient = object : BridgeWebChromeClient(bridge) {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                val source = Uri.parse(message.sourceId().orEmpty()).lastPathSegment.orEmpty().take(120)
                logWebDiagnostic("console/${message.messageLevel()}", "[$source:${message.lineNumber()}] ${message.message()}")
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR && message.message().startsWith("Uncaught"))
                    startupFailed("javascript-error")
                return super.onConsoleMessage(message)
            }
        }
        bridge.setWebViewClient(object : BridgeWebViewClient(bridge) {
            override fun onPageCommitVisible(view: WebView, url: String) {
                super.onPageCommitVisible(view, url)
                injectSafeArea(view)
            }
            private fun required(request: WebResourceRequest) = request.isForMainFrame ||
                (request.url.host == "localhost" && updater.engine.hasPath(request.url.path.orEmpty().trimStart('/')))
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (required(request)) startupFailed("load-error")
                super.onReceivedError(view,request,error)
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (required(request)) startupFailed("load-error")
                super.onReceivedHttpError(view,request,response)
            }
        })
        registerReceiver(screenReceiver, IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_USER_PRESENT)
        })
        val webFrame = findViewById<FrameLayout>(android.R.id.content)
        updateBanner = NativeUpdateBanner(webFrame, ::dismissUpdateBanner)
        val startupTheme = ledger
        loadingOverlay = LinearLayout(startupTheme).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(16.dp,12.dp,16.dp,12.dp); background = NativeLedger.panel(startupTheme)
            elevation = 8.dp.toFloat()
            addView(ProgressBar(startupTheme), LinearLayout.LayoutParams(24.dp,24.dp))
            addView(TextView(startupTheme).apply {
                text = "Starting ${updater.launch.version}…"; textSize = 14f; setTextColor(startupTheme.getColor(R.color.lb_ledger_ink))
                setPadding(12.dp,0,0,0)
            })
            visibility = if (updater.engine.snapshot().trial && updater.watchdog.showLoading) View.VISIBLE else View.GONE
        }
        webFrame.addView(loadingOverlay, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        updater.onChange = { if (!isFinishing) { refreshRecovery(); refreshDebugSettings?.invoke(); if (resumed) updater.shell.presentRequestedAndroidUi(this); showNativeMessages() } }
        updater.onToast = { text ->
            if (!isFinishing) {
                transientBanners.add(UpdateBannerItem("message:$text", "Please wait", text))
                showNativeMessages()
            }
        }
    }
    private fun setupEdgeToEdge(web: WebView) {
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS or WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)
        WindowCompat.enableEdgeToEdge(window)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = if (Build.VERSION.SDK_INT >= 30)
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                else WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        if (Build.VERSION.SDK_INT >= 29) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        val webHost = web.parent as View
        findViewById<View>(android.R.id.content).fitsSystemWindows = false
        webHost.fitsSystemWindows = false
        web.fitsSystemWindows = false
        ViewCompat.setOnApplyWindowInsetsListener(webHost) { view, insets ->
            safeArea = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            systemTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            cutoutRects = insets.displayCutout?.boundingRects.orEmpty()
            showNativeMessages()
            val keyboardOverlays = (window.attributes.softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST) ==
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
            val keyboard = if (keyboardOverlays) 0 else insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
            view.setPadding(0, 0, 0, keyboard)
            injectSafeArea(web)
            WindowInsetsCompat.Builder(insets).setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .setVisible(WindowInsetsCompat.Type.ime(), false).build()
        }
        ViewCompat.requestApplyInsets(webHost)
    }
    private fun injectSafeArea(web: WebView) {
        val density = resources.displayMetrics.density
        val origin = IntArray(2).also(web::getLocationInWindow)
        val rules = listOf("top" to safeArea.top, "right" to safeArea.right, "bottom" to safeArea.bottom, "left" to safeArea.left)
            .joinToString("") { (edge, px) -> "style.setProperty('--safe-area-inset-$edge','${px / density}px');" }
        val detail = JSONObject().put("top", safeArea.top / density).put("left", safeArea.left / density)
            .put("right", safeArea.right / density).put("rects", JSONArray().apply {
                cutoutRects.forEach { rect -> put(JSONObject()
                    .put("left", (rect.left - origin[0]) / density).put("top", (rect.top - origin[1]) / density)
                    .put("right", (rect.right - origin[0]) / density).put("bottom", (rect.bottom - origin[1]) / density)) }
            })
        web.evaluateJavascript("(function(){var style=document.documentElement && document.documentElement.style;if(style){$rules" +
            "style.setProperty('--lb-system-top','${systemTop / density}px');window.__lbWindowInsets=$detail;" +
            "window.dispatchEvent(new CustomEvent('lb-window-insets',{detail:window.__lbWindowInsets}));}})()", null)
    }
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        ViewCompat.requestApplyInsets(window.decorView)
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) configureSystemBars()
    }
    private fun configureSystemBars() {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.show(WindowInsetsCompat.Type.statusBars())
        controller.hide(WindowInsetsCompat.Type.navigationBars())
    }
    override fun onStart() {
        super.onStart()
        ShellUpdatedNotification.enterForeground(this)
        updater.setForeground(true)

    }
    override fun onResume() {
        super.onResume()
        resumed = true; refreshRecovery(); showNativeMessages()
        UpdateWorker.once(this,"start")
        updater.shell.maybeInstall() // recheck permission on return from unknown-app settings
        updater.shell.presentRequestedAndroidUi(this)
    }
    override fun onPause() {
        resumed = false; refreshRecovery()
        super.onPause()
    }
    override fun onStop() {
        updater.setForeground(false)
        ShellUpdatedNotification.leaveForeground()

        super.onStop()
    }
    private var afterNotificationPermission: (() -> Unit)? = null
    fun installWithNotificationPermission(action: () -> Unit) {
        if (ShellUpdatedNotification.enabled(this) && Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED &&
            !getPreferences(Context.MODE_PRIVATE).getBoolean("notificationAsked",false)) {
            getPreferences(Context.MODE_PRIVATE).edit().putBoolean("notificationAsked",true).apply()
            afterNotificationPermission = action
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),701)
        } else action()
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults)
        if(requestCode == 701) { val action=afterNotificationPermission; afterNotificationPermission=null; action?.invoke() }
    }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
    private fun recreateBundle() {
        var restarted = false
        val restart = Runnable {
            if (!restarted && !isDestroyed && !isFinishing) {
                restarted = true
                recreate()
            }
        }
        handler.postDelayed(restart, 250)
        bridge?.webView?.evaluateJavascript("window.dispatchEvent(new Event('lb:bundle-restart'))") {
            handler.removeCallbacks(restart)
            restart.run()
        }
    }
    fun restartBundle(reset: Boolean = false, startupRecovery: Boolean = false) { updater.restart(reset, startupRecovery, ::recreateBundle) }
    fun openReleases(): Boolean {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Updater.RELEASES_URL))); return true }
        catch (e: android.content.ActivityNotFoundException) {
            updater.engine.log.add("Could not open releases: ${e.message}")
            if (updater.gameCheckNotices() != true) {
                transientBanners.add(UpdateBannerItem("releases", "Could not open GitHub", "There’s no browser available to open the releases page."))
                showNativeMessages()
            }
            return false
        }
    }
    fun confirmReset(startupRecovery: Boolean = false) {
        NativeLedger.dialog(ledger, "Reset to built-in version?", warning = true)
            .setMessage("This removes downloaded updates and shows update setup again. Your saves stay.")
            .setPositiveButton("Reset") { _, _ ->
                restartBundle(reset = true, startupRecovery = startupRecovery && updater.watchdog.reason != null)
            }.setNegativeButton("Cancel", null).show()
    }
    private var debugDialog: AlertDialog? = null
    private var refreshDebugSettings: (() -> Unit)? = null
    fun showSettings() {
        if (debugDialog?.isShowing == true) return
        val box = LinearLayout(ledger).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,8.dp,20.dp,8.dp) }
        val versions = TextView(ledger).apply { text = "Playing version ${updater.launch.version}\nAndroid app ${BuildConfig.VERSION_NAME}" }
        val initial = updater.settingsJson()
        val switches = linkedMapOf<String, Switch>()
        val choices = linkedMapOf<String, Pair<Spinner, List<String>>>()
        box.addView(versions)
        val checkStatus = TextView(ledger).apply { text = if (updater.checks.hasError()) "Could not check for updates" else "" }
        val checkHelp = Button(ledger).apply {
            text = "ⓘ"
            contentDescription = "Update connection help"
            visibility = if (updater.checks.hasError()) View.VISIBLE else View.GONE
            setOnClickListener {
                NativeLedger.dialog(ledger, "Update connection help")
                    .setMessage("Sign in to public Wi-Fi or try mobile data. Check your device date and time, then try again.")
                    .setPositiveButton("Close", null).show()
            }
        }
        box.addView(LinearLayout(ledger).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(checkStatus, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(checkHelp, LinearLayout.LayoutParams(48.dp, 48.dp))
        })
        listOf("smallFixes" to "Small fixes: install automatically",
            "majorUpdates" to "New versions and big fixes: install automatically without asking",
            "shellUpdates" to "App updates: install automatically").forEach { (key,label) ->
            val control = Switch(ledger).apply { text = label; isChecked = initial.getBoolean(key) }
            switches[key] = control; box.addView(control)
        }
        fun choice(key: String, label: String, values: List<String>, labels: List<String>) {
            box.addView(TextView(ledger).apply { text = label })
            val control = Spinner(ledger).apply {
                adapter = ArrayAdapter(ledger, android.R.layout.simple_spinner_dropdown_item, labels)
                setSelection(values.indexOf(initial.get(key).toString()))
            }
            choices[key] = control to values; box.addView(control)
        }
        choice("wifiLimitMb", "Automatic download limit on Wi-Fi", listOf("5","20","50","100","-1"), listOf("5 MB","20 MB","50 MB","100 MB","No limit"))
        choice("mobileLimitMb", "Automatic download limit on mobile data", listOf("0","5","20","50","-1"), listOf("Never","5 MB","20 MB","50 MB","No limit"))
        choice("checkFrequency", "Check for updates", listOf("open","1h","6h","24h","manual"),
            listOf("When the app opens","Every hour","Every 6 hours","Every day","Only when I tap Check now"))
        box.addView(TextView(ledger).apply { text = "Only when I tap Check now disables all automatic checks, including critical fixes. Metered Wi-Fi counts as mobile data." })
        val checkButton = Button(ledger).apply {
            text = "Check for updates"
            setOnClickListener { updater.retryChecks() }
        }
        box.addView(checkButton)
        val shellUpdate = Button(ledger).apply {
            setOnClickListener {
                if (!updater.safeToInterrupt) return@setOnClickListener
                if (updater.shell.isReady()) updater.shell.installFromWeb(this@MainActivity)
                else updater.shell.check(consent = true, downloadOnly = true)
            }
        }
        fun refreshShellOffer() {
            val ready = updater.shell.manifest()?.takeIf { updater.shell.isReady() }?.versionName
            val available = updater.shell.availableState()?.optString("version")
            shellUpdate.text = if (ready != null) "Install update $ready" else "Download update $available"
            shellUpdate.visibility = if (ready != null || !available.isNullOrEmpty()) View.VISIBLE else View.GONE
            shellUpdate.isEnabled = updater.safeToInterrupt && !updater.shell.downloading
        }
        refreshShellOffer()
        box.addView(shellUpdate)
        box.addView(Button(ledger).apply { text = "Restart"; setOnClickListener { restartBundle(startupRecovery = updater.watchdog.reason != null) } })
        box.addView(Button(ledger).apply { text = "Logs"; setOnClickListener { showLogs() } })
        box.addView(Button(ledger).apply {
            text = "Simulate broken start (next launch only)"
            setOnClickListener {
                val message = if (updater.simulateBrokenStart()) "Simulation armed. Restart the app to test recovery."
                    else "Could not arm the simulation."
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
            }
        })
        val reset = Button(ledger).apply {
            text = "Reset to built-in version"
            setOnClickListener { confirmReset(startupRecovery = updater.watchdog.reason != null) }
        }
        box.addView(reset)
        val closeShell = Button(ledger).apply { text = "Close"; contentDescription = "Close app maintenance" }
        val shellHeader = LinearLayout(ledger).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 8.dp, 20.dp, 0)
            addView(NativeLedger.title(ledger, "App maintenance"),
                LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(closeShell)
        }
        val maintenance = FrameLayout(ledger).apply { addView(ScrollView(ledger).apply { addView(box) }) }
        maintenanceBanner = NativeUpdateBanner(maintenance, ::dismissUpdateBanner)
        val dialog = NativeLedger.dialog(ledger).setCustomTitle(shellHeader).setView(maintenance)
            .setCancelable(true).setPositiveButton("Save",null).create()
        dialog.setCanceledOnTouchOutside(false)
        closeShell.setOnClickListener { dialog.cancel() }
        debugDialog = dialog
        refreshDebugSettings = {
            refreshShellOffer()
            checkStatus.text = if (updater.checks.hasError()) "Could not check for updates" else ""
            checkHelp.visibility = if (updater.checks.hasError()) View.VISIBLE else View.GONE
            val latest = updater.settingsJson()
            switches.forEach { (key,control) ->
                if (control.isChecked == initial.getBoolean(key)) {
                    control.isChecked = latest.getBoolean(key); initial.put(key,latest.getBoolean(key))
                }
            }
            choices.forEach { (key,pair) ->
                if (pair.second[pair.first.selectedItemPosition] == initial.get(key).toString()) {
                    pair.first.setSelection(pair.second.indexOf(latest.get(key).toString())); initial.put(key,latest.get(key))
                }
            }
        }
        dialog.setOnDismissListener {
            maintenanceBanner?.clear(); maintenanceBanner = null
            debugDialog = null; refreshDebugSettings = null; refreshRecovery(); showNativeMessages()
        }
        dialog.setOnShowListener { dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            try {
                val patch = com.getcapacitor.JSObject().put("setupAnswered",true)
                switches.forEach { (key,control) -> if (control.isChecked != initial.getBoolean(key)) patch.put(key,control.isChecked) }
                choices.forEach { (key,pair) ->
                    val value = pair.second[pair.first.selectedItemPosition]
                    if (value != initial.get(key).toString()) patch.put(key,if (key == "checkFrequency") value else value.toInt())
                }
                updater.setUpdateSettings(patch)
                dialog.dismiss(); showNativeMessages()
            }
            catch (e: Exception) { updater.engine.log.add("Could not save update settings: ${e.message}"); checkStatus.text = "Could not save update settings" }
        } }; dialog.show()
        maintenance.post { showNativeMessages() }
    }
    private val nativeSeen = mutableSetOf<String>()
    internal fun setUiTheme(light: Boolean) {
        if (NativeLedger.light(this) == light) return
        NativeLedger.setLight(this, light)
        showNativeMessages()
    }

    private fun dismissUpdateBanner(key: String) {
        nativeSeen.add(key)
        if (key.startsWith("app-installed:")) getSharedPreferences("native-update-messages", Context.MODE_PRIVATE)
            .edit().putBoolean(key, true).apply()
        transientBanners.removeAll { it.key == key }
        showNativeMessages()
    }
    private fun showNativeMessages() {
        val maintenance = maintenanceBanner
        val banner = maintenance ?: updateBanner ?: return
        if (maintenance != null) updateBanner?.clear()
        val webNotices = updater.gameCheckNotices()
        if (!resumed || isFinishing || isDestroyed || logDialog != null ||
            (maintenance == null && (recoveryDialog != null || webNotices != false))) {
            banner.clear(); activeBannerKey = null; return
        }
        updater.checks.claim()?.let { notice ->
            transientBanners.add(UpdateBannerItem("check:${SystemClock.elapsedRealtime()}", "Could not check for updates",
                "Check your connection and try again.", "Retry", { updater.retryCheck(notice.channel) }))
        }
        val state = updater.info()
        val items = transientBanners.toMutableList()
        state.optJSONObject("rolledBack")?.let {
            items.add(UpdateBannerItem("rollback:${it.optString("from")}:${it.optString("to")}", "Previous version restored",
                "Version ${it.optString("from")} could not start. You’re back on ${it.optString("to")}.", "Details", ::showLogs))
        }
        state.optJSONObject("updated")?.let {
            items.add(UpdateBannerItem("updated:${it.optString("to")}", "Update installed", "You’re now on version ${it.optString("to")}."))
        }
        val installedKey = "app-installed:${BuildConfig.VERSION_CODE}"
        if (updater.shell.installedNotes() != null && !getSharedPreferences("native-update-messages", Context.MODE_PRIVATE).getBoolean(installedKey, false)) {
            items.add(UpdateBannerItem(installedKey, "App update installed", "You’re now on version ${BuildConfig.VERSION_NAME}."))
        }
        val webDownload = state.optJSONObject("webTransfer").takeIf { state.optBoolean("busy") && state.optString("webDownloadVersion").isNotBlank() }
        val appDownloading = state.optBoolean("shellDownloading")
        if (webDownload != null || appDownloading) {
            val transfer = webDownload ?: state.optJSONObject("shellTransfer")
            val total = transfer?.optLong("total") ?: 0
            val progress = if (total > 0) (100.0 * transfer!!.optLong("done") / total).toInt().coerceIn(0, 100) else null
            items.add(UpdateBannerItem("download:${if (webDownload != null) state.optString("webDownloadVersion") else "app"}",
                "Downloading update", "Leave Linebreaker open or come back later.", percent = progress, downloading = true))
        }
        val appReady = state.optJSONObject("shellReady")
        if (!appDownloading) (appReady ?: state.optJSONObject("shellAvailable"))?.let {
            val version = it.optString("version")
            items.add(if (appReady != null) UpdateBannerItem("app-ready:$version", "App update ready", "Version $version is ready to install.",
                "Install update $version", { installWithNotificationPermission { updater.shell.installFromWeb(this) } })
            else UpdateBannerItem("app-offer:$version", "App update available", "Version $version · ${updater.formatSize(it.optLong("size"))}",
                "Download update $version", { updater.shell.check(consent = true, downloadOnly = true) }))
        }
        val staged = state.optJSONObject("staged")
        if (!state.optBoolean("busy")) (staged ?: state.optJSONObject("available"))?.let {
            val version = it.optString("version")
            items.add(when {
                staged != null -> UpdateBannerItem("ready:$version", "Update ready", "Restart Linebreaker to finish updating.", "Restart to apply", { restartBundle(startupRecovery = updater.watchdog.reason != null) })
                it.optBoolean("needsShell") -> UpdateBannerItem("app-first:$version", "Update available", "Install the app update first to get version $version.")
                else -> UpdateBannerItem("offer:$version", "Update available", "Version $version · ${updater.formatSize(it.optLong("size"))}", "Download update $version", updater::download)
            })
        }
        val error = updateFailure(updater.status, updater.shell.status)
        if (error != null) items.add(UpdateBannerItem("error:$error", "Could not update", "Check your connection or try again later.", "Details", ::showLogs))
        val queue = items.filter { it.key !in nativeSeen }
        val next = queue.firstOrNull { it.key == activeBannerKey } ?: queue.firstOrNull()
        activeBannerKey = next?.key
        val bandInset = maxOf(safeArea.top, systemTop)
        val bandHeight = if (bandInset > 0) bandInset + 14.dp else 0
        if (maintenance == null) banner.render(next, bandHeight, safeArea.left, safeArea.right)
        else banner.render(next, 0, 0, 0)
    }
    private fun updateFailure(vararg states: String) = states.firstOrNull {
        it.startsWith("Download failed") || it.startsWith("Install failed") || it.startsWith("App install failed") ||
            it.startsWith("Shell update processing failed") || it.startsWith("Update processing failed") || it.startsWith("Restart failed") ||
            it.contains("Not enough storage")
    }
    internal fun logWebDiagnostic(level: String, message: String) {
        updater.engine.log.add("WebView ${level.take(24)}: ${message.take(1200).replace('\r', ' ')}")
    }
    internal fun logEnvironment(): String {
        val webView = runCatching { WebView.getCurrentWebViewPackage() }.getOrNull()
        val version = webView?.let { "${it.packageName} ${it.versionName}" } ?: "unknown"
        return "WebView: $version\nAndroid: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\nDevice: ${Build.MANUFACTURER} ${Build.MODEL}"
    }
    private fun logsText() = "${logEnvironment()}\nUpdate address: ${updater.url}\nApp ${BuildConfig.VERSION_NAME} / API ${BuildConfig.SHELL_API}\n${updater.status} · ${updater.shell.status}\n\n${updater.checks.summary()}\n${updater.checks.snapshot()}\n\nstate.json\n${updater.engine.stateJson()}\n\nNewest first (last 500 lines)\n${updater.engine.log.read()}"
    private fun renderLogs() { logText?.text = logsText() }
    private fun copyLogs() {
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("OTA state and logs", logsText()))
        Toast.makeText(this, "Logs copied", Toast.LENGTH_SHORT).show()
    }
    fun showLogs() {
        if (logDialog?.isShowing == true) return
        logText = TextView(ledger).apply { textSize = 12f; typeface = android.graphics.Typeface.MONOSPACE; setTextIsSelectable(true); setPadding(20.dp,8.dp,20.dp,8.dp) }
        val scroll = ScrollView(ledger).apply { addView(logText) }
        logDialog = NativeLedger.dialog(ledger, "Updater logs · live").setView(scroll)
            .setPositiveButton("Close", null).setNeutralButton("Copy",null).setNegativeButton("Clear",null).create()
        logDialog!!.setOnShowListener {
            logDialog!!.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener { copyLogs() }
            logDialog!!.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener { updater.engine.log.clear(); renderLogs() }
            renderLogs(); handler.postDelayed(refreshLogs,1000)
        }
        logDialog!!.setOnDismissListener { handler.removeCallbacks(refreshLogs); logDialog = null; logText = null; if (!isDestroyed) refreshRecovery() }
        logDialog!!.show()
    }
    override fun onDestroy() {
        handler.removeCallbacks(recoveryTick); recoveryDialog?.dismiss(); updateBanner?.clear()
        debugDialog?.setOnDismissListener(null); debugDialog?.dismiss(); refreshDebugSettings = null
        unregisterReceiver(screenReceiver)
        handler.removeCallbacks(refreshLogs); logDialog?.setOnDismissListener(null); logDialog?.dismiss()
        updater.onChange = null; updater.onToast = null
        super.onDestroy()
    }
}
