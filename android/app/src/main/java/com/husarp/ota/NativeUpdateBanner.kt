package com.husarp.ota

import android.animation.ValueAnimator
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.InsetDrawable
import android.graphics.drawable.LayerDrawable
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
import com.husarp.ota.core.UpdateBannerStep
import com.husarp.linebreaker.R
import java.util.Locale

internal data class UpdateBannerItem(
    val key: String, val title: String, val text: String, val actionLabel: String? = null,
    val action: (() -> Unit)? = null, val percent: Int? = null, val downloading: Boolean = false,
    val keepOnAction: Boolean = false, val installing: Boolean = false, val brief: Boolean = false,
    val step: UpdateBannerStep? = null, val speed: Long = 0
)

internal class NativeUpdateBanner(private val host: FrameLayout, private val dismiss: (String) -> Unit) {
    private var panel: View? = null
    private var progress: ProgressBar? = null
    private var progressLabel: TextView? = null
    private var key: String? = null
    private var light = false
    private val Int.dp get() = (this * host.resources.displayMetrics.density + .5f).toInt()

    fun clear() {
        panel?.let(host::removeView)
        panel = null; progress = null; progressLabel = null; key = null
    }

    private fun progressText(item: UpdateBannerItem): String {
        val speed = when {
            item.speed >= 1_000_000 -> String.format(Locale.US, "%.1f MB/s", item.speed / 1_000_000.0)
            item.speed >= 1_000 -> String.format(Locale.US, "%.1f kB/s", item.speed / 1_000.0)
            item.speed > 0 -> "${item.speed} B/s"
            else -> null
        }
        return listOfNotNull(item.percent?.let { "$it%" }, speed).joinToString("  ")
    }

    fun render(item: UpdateBannerItem?, top: Int, left: Int, right: Int) {
        if (item == null) { clear(); return }
        val currentLight = NativeLedger.light(host.context)
        val startMargin = maxOf(left, 12.dp)
        val endMargin = maxOf(right, 12.dp)
        val layout = FrameLayout.LayoutParams(
            minOf(448.dp, host.width.takeIf { it > 0 }?.minus(startMargin + endMargin) ?: 320.dp).coerceAtLeast(1),
            FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL
        ).apply { setMargins(startMargin, top, endMargin, 0) }
        if (key == item.key && light == currentLight) {
            val previous = panel?.layoutParams as? FrameLayout.LayoutParams
            if (previous == null || previous.topMargin != layout.topMargin || previous.leftMargin != layout.leftMargin ||
                previous.rightMargin != layout.rightMargin || previous.width != layout.width) panel?.layoutParams = layout
            progress?.apply { isIndeterminate = item.percent == null; item.percent?.let { setProgress(it) } }
            progressLabel?.apply { text = progressText(item); visibility = if (text.isEmpty()) View.GONE else View.VISIBLE }
            return
        }
        val alreadyVisible = panel != null
        clear()
        key = item.key
        light = currentLight
        val context = NativeLedger.context(host.context)
        val label = Color.parseColor(if (light) "#332d19" else "#fff4d6")
        val edge = Color.parseColor(if (light) "#866625" else "#e5bd70")
        val face = Color.parseColor(if (light) "#fff3d6" else "#4c5d35")
        val card = GradientDrawable().apply { setColor(face); cornerRadius = 4.dp.toFloat(); setStroke(1.dp, edge) }
        val stitch = GradientDrawable().apply {
            setColor(Color.TRANSPARENT); cornerRadius = 2.dp.toFloat(); setStroke(1.dp, edge, 3.dp.toFloat(), 3.dp.toFloat())
        }
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            elevation = 2.dp.toFloat()
            background = LayerDrawable(arrayOf(card, InsetDrawable(stitch, 4.dp)))
            setPadding(13.dp, 12.dp, 8.dp, 12.dp)
        }
        fun dismissItem() { dismiss(item.key) }
        var down = 0f
        row.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { down = event.rawY; true }
                MotionEvent.ACTION_UP -> { if (!item.installing && down - event.rawY > 36.dp) dismissItem(); true }
                else -> true
            }
        }
        row.addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_update_notice); setColorFilter(edge)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }, LinearLayout.LayoutParams(22.dp, 22.dp).apply { setMargins(0, 6.dp, 10.dp, 0) })
        val copy = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        row.addView(copy, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        copy.addView(TextView(context).apply {
            text = item.title; textSize = 12f; typeface = NativeLedger.heading(context); setTextColor(label)
            maxLines = 2; ellipsize = TextUtils.TruncateAt.END; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        })
        if (item.text.isNotEmpty()) copy.addView(TextView(context).apply { text = item.text; textSize = 14f; setTextColor(label) })
        if (item.downloading || item.installing) {
            if (item.downloading) progressLabel = TextView(context).apply {
                text = progressText(item); textSize = 12f; setTextColor(label)
                visibility = if (text.isEmpty()) View.GONE else View.VISIBLE
                copy.addView(this)
            }
            val bar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = 100; isIndeterminate = item.percent == null; progress = item.percent ?: 0
                contentDescription = if (item.installing) "Installing update" else "Update download progress"
                progressTintList = ColorStateList.valueOf(edge)
                indeterminateTintList = ColorStateList.valueOf(edge)
                progressBackgroundTintList = ColorStateList.valueOf(context.getColor(R.color.lb_ledger_track))
            }
            progress = bar
            copy.addView(bar)
        }
        if (item.actionLabel != null) copy.addView(Button(context).apply {
            text = item.actionLabel
            setOnClickListener { if (!item.keepOnAction) dismissItem(); item.action?.invoke() }
        })
        if (!item.installing) row.addView(Button(context).apply {
            text = "✕"; contentDescription = "Dismiss update notice"; setTextColor(label)
            backgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
            stateListAnimator = null
            setPadding(0, 0, 0, 0)
            setOnClickListener { dismissItem() }
        }, LinearLayout.LayoutParams(44.dp, 44.dp))
        host.addView(row, layout)
        panel = row
        if (!alreadyVisible) row.post {
            if (panel === row && !item.installing && ValueAnimator.areAnimatorsEnabled()) {
                row.translationY = -row.height.toFloat()
                row.alpha = 0f
                row.animate().translationY(0f).alpha(1f).setDuration(220).start()
            }
        }
        if (item.brief) row.postDelayed({ if (panel === row) dismissItem() }, 5000)
    }
}
