package com.husarp.ota

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.app.KeyguardManager
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
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.BridgeActivity
import com.getcapacitor.ProcessedRoute
import com.husarp.ota.core.*
import com.husarp.linebreaker.BuildConfig

class MainActivity : BridgeActivity() {
    private val updater get() = (application as OtaApplication).updater
    private val handler = Handler(Looper.getMainLooper())
    private var resumed = false
    private var recoveryDialog: AlertDialog? = null
    private var loadingOverlay: View? = null
    private val recoveryTick = Runnable { refreshRecovery() }
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) { refreshRecovery() }
    }
    private fun refreshRecovery() {
        handler.removeCallbacks(recoveryTick)
        val trial = updater.engine.snapshot().trial
        val awake = (getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive &&
            !(getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
        val delay = updater.recovery.update(SystemClock.elapsedRealtime(), resumed && awake, trial)
        loadingOverlay?.visibility = if (trial && updater.recovery.showLoading) View.VISIBLE else View.GONE
        if (!trial) { recoveryDialog?.dismiss(); recoveryDialog = null }
        if (resumed && awake && trial && updater.recovery.reason != null && recoveryDialog == null && !isFinishing) {
            val reason = updater.recovery.reason!!
            val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,12.dp,20.dp,12.dp) }
            val dialog = AlertDialog.Builder(this).setTitle("${updater.launch.version} didn't start properly")
                .setView(box).setCancelable(false).create()
            box.addView(Button(this).apply {
                text = "Go back to version ${updater.engine.recoveryTarget()}"
                setOnClickListener {
                    isEnabled = false
                    try {
                        if (!updater.recoverNow(reason) { recreate() }) refreshRecovery()
                    } catch (e: Exception) {
                        isEnabled = true
                        Toast.makeText(this@MainActivity,"Recovery failed; try again",Toast.LENGTH_LONG).show()
                    }
                }
            })
            box.addView(Button(this).apply {
                text = "Open download page"
                setOnClickListener { openReleases() }
            })
            box.addView(TextView(this).apply {
                text = "Wait"; textSize = 12f; gravity = Gravity.CENTER; setPadding(12.dp,16.dp,12.dp,16.dp)
                setOnClickListener { updater.recovery.waitLonger(SystemClock.elapsedRealtime()); dialog.dismiss(); recoveryDialog = null; refreshRecovery() }
            })
            box.addView(TextView(this).apply {
                text = "If the app works fine and was just slow to start, tap Wait and ignore this message."
                textSize = 14f; setPadding(0,8.dp,0,0)
            })
            nativeMessageDialog?.dismiss()
            recoveryDialog = dialog; dialog.show()
        }
        if (delay != null) handler.postDelayed(recoveryTick, delay.coerceAtLeast(1))
    }
    private fun startupFailed(reason: String) {
        updater.recovery.failed(updater.engine.snapshot().trial, reason)
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
        updater.prepareLaunch()
        updater.recovery.launch(updater.launch.token, SystemClock.elapsedRealtime())
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
        hideSystemBars()
        val web = bridge.webView
        // Keep Capacitor routing and browser features while catching failures independently of bundle JS.
        web.webChromeClient = object : BridgeWebChromeClient(bridge) {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR && message.message().startsWith("Uncaught"))
                    startupFailed("javascript-error")
                return super.onConsoleMessage(message)
            }
        }
        bridge.setWebViewClient(object : BridgeWebViewClient(bridge) {
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
        loadingOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(16.dp,12.dp,16.dp,12.dp); setBackgroundColor(Color.WHITE)
            elevation = 8.dp.toFloat()
            addView(ProgressBar(this@MainActivity), LinearLayout.LayoutParams(24.dp,24.dp))
            addView(TextView(this@MainActivity).apply {
                text = "Starting ${updater.launch.version}…"; textSize = 14f; setTextColor(Color.DKGRAY)
                setPadding(12.dp,0,0,0)
            })
            visibility = if (updater.engine.snapshot().trial && updater.recovery.showLoading) View.VISIBLE else View.GONE
        }
        webFrame.addView(loadingOverlay, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        updater.onChange = { if (!isFinishing) { refreshRecovery(); refreshDebugSettings?.invoke(); if (updater.foreground) updater.shell.presentRequestedAndroidUi(this); showNativeMessages() } }
        updater.onToast = { text -> if (!isFinishing) Toast.makeText(this, text, Toast.LENGTH_LONG).show() }
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }
    private fun hideSystemBars() {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }
    override fun onStart() {
        super.onStart()
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

        super.onStop()
    }
    private var afterNotificationPermission: (() -> Unit)? = null
    fun installWithNotificationPermission(action: () -> Unit) {
        if (android.os.Build.VERSION.SDK_INT >= 33 &&
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
    fun restartBundle(reset: Boolean = false) { updater.restart(reset) { recreate() } }
    fun openReleases() {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Updater.RELEASES_URL))) }
        catch (e: android.content.ActivityNotFoundException) { Toast.makeText(this,"No browser available",Toast.LENGTH_LONG).show() }
    }
    fun confirmReset() {
        AlertDialog.Builder(this).setTitle("Reset to built-in version?")
            .setMessage("Downloaded web bundles will be removed and update setup will appear again. Your saves stay.")
            .setPositiveButton("Reset") { _, _ -> restartBundle(true) }.setNegativeButton("Cancel", null).show()
    }
    private var debugDialog: AlertDialog? = null
    private var refreshDebugSettings: (() -> Unit)? = null
    fun showSettings() {
        if (debugDialog?.isShowing == true) return
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(20.dp,8.dp,20.dp,8.dp) }
        val versions = TextView(this).apply { text = "App / shell ${BuildConfig.VERSION_NAME}\nshellApi ${BuildConfig.SHELL_API}\nWeb ${updater.launch.version}\nEmbedded ${updater.engine.embedded.version}" }
        val initial = updater.settingsJson()
        val switches = linkedMapOf<String, Switch>()
        val choices = linkedMapOf<String, Pair<Spinner, List<String>>>()
        box.addView(versions)
        box.addView(TextView(this).apply { text = "State: ${updater.status}\nShell: ${updater.shell.status}" })
        listOf("smallFixes" to "Small fixes: install automatically",
            "majorUpdates" to "New versions and big fixes: install automatically without asking",
            "shellUpdates" to "App (shell) updates: install automatically").forEach { (key,label) ->
            val control = Switch(this).apply { text = label; isChecked = initial.getBoolean(key) }
            switches[key] = control; box.addView(control)
        }
        fun choice(key: String, label: String, values: List<String>, labels: List<String>) {
            box.addView(TextView(this).apply { text = label })
            val control = Spinner(this).apply {
                adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, labels)
                setSelection(values.indexOf(initial.get(key).toString()))
            }
            choices[key] = control to values; box.addView(control)
        }
        choice("wifiLimitMb", "Automatic download limit on Wi-Fi", listOf("5","20","50","100","-1"), listOf("5 MB","20 MB","50 MB","100 MB","No limit"))
        choice("mobileLimitMb", "Automatic download limit on mobile data", listOf("0","5","20","50","-1"), listOf("Never","5 MB","20 MB","50 MB","No limit"))
        choice("checkFrequency", "Check for updates", listOf("open","1h","6h","24h","manual"),
            listOf("When the app opens","Every hour","Every 6 hours","Every day","Only when I tap Check now"))
        box.addView(TextView(this).apply { text = "Only when I tap Check now disables all automatic checks, including critical fixes. Metered Wi-Fi counts as mobile data." })
        val address = EditText(this).apply { setText(initial.getString("url")); inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI; hint = "HTTPS manifest URL"; textSize = 14f }
        box.addView(TextView(this).apply { text = "Update URL" }); box.addView(address)
        val messages = Switch(this).apply {
            text = "Show update messages from the shell (debug)"; isChecked = updater.showShellMessages
        }
        box.addView(messages)
        box.addView(Button(this).apply { text = "Check now"; setOnClickListener { updater.check(true); updater.shell.check(manual = true) } })
        box.addView(Button(this).apply { text = "Restart"; setOnClickListener { restartBundle() } })
        val reset = Button(this).apply {
            text = "Reset to built-in version"
            setOnClickListener { confirmReset() }
        }
        box.addView(reset)
        val dialog = AlertDialog.Builder(this).setTitle("Debug").setView(ScrollView(this).apply { addView(box) }).setPositiveButton("Save",null).setNegativeButton("Cancel",null).create()
        debugDialog = dialog
        refreshDebugSettings = {
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
            if (address.text.toString() == initial.getString("url")) {
                address.setText(latest.getString("url")); initial.put("url",latest.getString("url"))
            }
        }
        dialog.setOnDismissListener { debugDialog = null; refreshDebugSettings = null; showNativeMessages() }
        dialog.setOnShowListener { dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            try {
                val patch = com.getcapacitor.JSObject().put("setupAnswered",true)
                switches.forEach { (key,control) -> if (control.isChecked != initial.getBoolean(key)) patch.put(key,control.isChecked) }
                choices.forEach { (key,pair) ->
                    val value = pair.second[pair.first.selectedItemPosition]
                    if (value != initial.get(key).toString()) patch.put(key,if (key == "checkFrequency") value else value.toInt())
                }
                val url = address.text.toString().trim()
                if (url != initial.getString("url")) patch.put("url",url)
                updater.setUpdateSettings(patch)
                updater.showShellMessages = messages.isChecked
                dialog.dismiss(); showNativeMessages()
            }
            catch (e: Exception) { address.error = e.message }
        } }; dialog.show()
    }
    private var nativeMessageDialog: AlertDialog? = null
    private val nativeSeen = mutableSetOf<String>()
    private fun showNativeMessages() {
        if (!updater.showShellMessages) { nativeMessageDialog?.dismiss(); return }
        if (!resumed || isFinishing || isDestroyed || recoveryDialog != null || debugDialog != null || updater.engine.snapshot().trial || !updater.safeToInterrupt ||
            !updater.updateSettings().setupAnswered || nativeMessageDialog != null) return
        val state = updater.info()
        val notices = getSharedPreferences("native-update-messages", Context.MODE_PRIVATE)
        fun show(key: String, title: String, detail: String = "", actionLabel: String? = null, action: (() -> Unit)? = null): Boolean {
            if (key in nativeSeen || notices.getBoolean(key,false)) return false
            nativeSeen.add(key)
            val builder = AlertDialog.Builder(this).setTitle(title).setMessage(detail)
                .setNegativeButton(if (actionLabel == null) "Close" else "Later") { _, _ -> notices.edit().putBoolean(key,true).apply() }
            if (actionLabel != null) builder.setPositiveButton(actionLabel) { _, _ -> action?.invoke() }
            nativeMessageDialog = builder.create().apply {
                setOnCancelListener { notices.edit().putBoolean(key,true).apply() }
                setOnDismissListener { nativeMessageDialog = null; handler.post { showNativeMessages() } }
                show()
            }
            return true
        }
        state.optJSONObject("rolledBack")?.let {
            if (show("rolledBack:${it.optString("from")}:${it.optString("to")}",
                "Version ${it.optString("from")} didn't start, so you're back on ${it.optString("to")}. A fix is on the way.")) return
        }
        state.optJSONObject("updated")?.let {
            if (show("updated:${it.optString("to")}", "What's new in ${it.optString("to")}",it.optString("notes"))) return
        }
        state.optJSONObject("shellReady")?.let {
            if (show("shell:${it.optLong("versionCode")}", "App update ${it.optString("version")} ready · Install",updater.formatSize(it.optLong("size")),"Install") {
                installWithNotificationPermission { updater.shell.installFromWeb(this) }
            }) return
        }
        if (!state.optBoolean("busy") && !state.optBoolean("shellUpdateReady")) state.optJSONObject("shellAvailable")?.let {
            if (show("shell-offer:${it.optLong("versionCode")}", "App update ${it.optString("version")}",updater.formatSize(it.optLong("size")),"Update") { installWithNotificationPermission { updater.shell.check(true) } }) return
        }
        val staged = state.optJSONObject("staged")
        if (staged != null && !state.optBoolean("autoRestart")) {
            show("staged:${staged.optString("version")}", "Fixes downloaded (${staged.optString("version")}) · Restart",actionLabel = "Restart") { restartBundle() }
        } else if (staged == null && !state.optBoolean("busy")) state.optJSONObject("available")?.let {
            if (it.optBoolean("needsShell")) show("needs-shell:${it.optString("version")}", "${it.optString("version")} needs the app update first")
            else show("offer:${it.optString("version")}", "New version ${it.optString("version")}",updater.formatSize(it.optLong("size")),"Update") { updater.download() }
        }
    }
    private fun renderLogs() { logText?.text = "state.json\n${updater.engine.stateJson()}\n\nNewest first (last 500 lines)\n${updater.engine.log.read()}" }
    fun showLogs() {
        if (logDialog?.isShowing == true) return
        logText = TextView(this).apply { textSize = 12f; typeface = android.graphics.Typeface.MONOSPACE; setTextIsSelectable(true); setPadding(12.dp,8.dp,12.dp,8.dp) }
        val scroll = ScrollView(this).apply { addView(logText) }
        logDialog = AlertDialog.Builder(this).setTitle("Updater logs · live") .setView(scroll)
            .setPositiveButton("Close", null).setNeutralButton("Copy",null).setNegativeButton("Clear",null).create()
        logDialog!!.setOnShowListener {
            logDialog!!.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener {
                (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("OTA state and logs",logText?.text))
                Toast.makeText(this,"Logs copied",Toast.LENGTH_SHORT).show()
            }
            logDialog!!.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener { updater.engine.log.clear(); renderLogs() }
            renderLogs(); handler.postDelayed(refreshLogs,1000)
        }
        logDialog!!.setOnDismissListener { handler.removeCallbacks(refreshLogs); logDialog = null; logText = null }
        logDialog!!.show()
    }
    override fun onDestroy() {
        handler.removeCallbacks(recoveryTick); recoveryDialog?.dismiss(); nativeMessageDialog?.setOnDismissListener(null); nativeMessageDialog?.dismiss()
        debugDialog?.setOnDismissListener(null); debugDialog?.dismiss(); refreshDebugSettings = null
        unregisterReceiver(screenReceiver)
        handler.removeCallbacks(refreshLogs); logDialog?.dismiss()
        updater.onChange = null; updater.onToast = null
        super.onDestroy()
    }
}
