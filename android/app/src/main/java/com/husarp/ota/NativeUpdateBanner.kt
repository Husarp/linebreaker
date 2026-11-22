package com.husarp.ota

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.husarp.linebreaker.R

internal data class UpdateBannerItem(
    val key: String, val title: String, val text: String, val actionLabel: String? = null,
    val action: (() -> Unit)? = null, val percent: Int? = null, val downloading: Boolean = false
)

internal class NativeUpdateBanner(private val host: FrameLayout, private val dismiss: (String) -> Unit) {
    private val context = host.context
    private val accent = Color.rgb(140, 235, 224)
    private val pixel = runCatching { Typeface.createFromAsset(context.assets, "public/assets/fonts/PressStart2P-Regular.ttf") }.getOrDefault(Typeface.MONOSPACE)
    private var panel: View? = null
    private var progress: ProgressBar? = null
    private var key: String? = null
    private val Int.dp get() = (this * context.resources.displayMetrics.density + .5f).toInt()

    fun clear() {
        panel?.let(host::removeView)
        panel = null; progress = null; key = null
    }

    fun render(item: UpdateBannerItem?, top: Int, left: Int, right: Int) {
        if (item == null) { clear(); return }
        val layout = FrameLayout.LayoutParams(
            minOf(448.dp, host.width.takeIf { it > 0 }?.minus(left + right + 24.dp) ?: 320.dp).coerceAtLeast(1),
            FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL
        ).apply { setMargins(left + 12.dp, top, right + 12.dp, 0) }
        if (key == item.key) {
            val previous = panel?.layoutParams as? FrameLayout.LayoutParams
            if (previous == null || previous.topMargin != layout.topMargin || previous.leftMargin != layout.leftMargin ||
                previous.rightMargin != layout.rightMargin || previous.width != layout.width) panel?.layoutParams = layout
            progress?.apply { isIndeterminate = item.percent == null; item.percent?.let { setProgress(it) } }
            return
        }
        clear()
        key = item.key
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(12.dp, 8.dp, 6.dp, 10.dp)
            elevation = 12.dp.toFloat()
            background = GradientDrawable().apply {
                cornerRadius = 5.dp.toFloat(); setColor(Color.rgb(38, 43, 39)); setStroke(1.dp, Color.rgb(119, 127, 118))
            }
        }
        fun dismissItem() { dismiss(item.key) }
        var down = 0f
        row.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { down = event.rawY; true }
                MotionEvent.ACTION_UP -> { if (down - event.rawY > 36.dp) dismissItem(); true }
                else -> true
            }
        }
        row.addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_update_notice); setColorFilter(accent)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(22.dp, 22.dp).apply { setMargins(0, 6.dp, 10.dp, 0) })
        val copy = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        row.addView(copy, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        copy.addView(TextView(context).apply {
            text = item.title; textSize = 9f; typeface = pixel; setTextColor(accent)
            isSingleLine = true; ellipsize = TextUtils.TruncateAt.END; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        })
        copy.addView(TextView(context).apply { text = item.text; textSize = 14f; setTextColor(Color.WHITE) })
        if (item.downloading) {
            val bar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = 100; isIndeterminate = item.percent == null; progress = item.percent ?: 0
                contentDescription = "Update download progress"
            }
            progress = bar
            copy.addView(bar)
        }
        if (item.actionLabel != null) copy.addView(Button(context).apply {
            text = item.actionLabel; isAllCaps = false; setTextColor(Color.WHITE)
            backgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(59, 73, 66))
            setOnClickListener { dismissItem(); item.action?.invoke() }
        })
        row.addView(Button(context).apply {
            text = "✕"; contentDescription = "Dismiss update notice"; setTextColor(Color.WHITE)
            setBackgroundColor(Color.TRANSPARENT); setPadding(0, 0, 0, 0)
            setOnClickListener { dismissItem() }
        }, LinearLayout.LayoutParams(44.dp, 44.dp))
        host.addView(row, layout)
        panel = row
        row.post {
            if (panel === row) {
                row.translationY = -row.height.toFloat()
                row.alpha = 0f
                row.animate().translationY(0f).alpha(1f).setDuration(220).start()
            }
        }
    }
}
