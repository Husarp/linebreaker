package com.husarp.ota

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import kotlin.math.roundToInt

internal class StartupScreen(context: Context, private val appName: String, heading: Typeface) : FrameLayout(context) {
    private val Int.dp get() = (this * resources.displayMetrics.density).roundToInt()
    private val card = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setPadding(24.dp, 24.dp, 24.dp, 24.dp)
    }
    private val name = TextView(context).apply { text = appName; textSize = 16f; typeface = heading; gravity = Gravity.CENTER }
    private val title = TextView(context).apply { textSize = 18f; gravity = Gravity.CENTER }
    private val status = TextView(context).apply {
        textSize = 14f; gravity = Gravity.CENTER; accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    private val spinner = ProgressBar(context).apply { importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }
    private var lightPalette: Boolean? = null

    init {
        isClickable = true
        elevation = 8.dp.toFloat()
        visibility = GONE
        addView(card, LayoutParams(1, WRAP_CONTENT, Gravity.CENTER))
        card.addView(name, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        card.addView(title, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = 16.dp })
        card.addView(status, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = 8.dp })
        card.addView(spinner, LinearLayout.LayoutParams(24.dp, 24.dp).apply { topMargin = 20.dp })
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        card.layoutParams.width = minOf(384.dp, (width - 32.dp).coerceAtLeast(1))
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    fun show(version: String, step: String, light: Boolean) {
        if (lightPalette != light) {
            lightPalette = light
            fun color(day: String, night: String) = Color.parseColor(if (light) day else night)
            val label = color("#245a44", "#bbdba9")
            setBackgroundColor(color("#f4e9cd", "#141f1a"))
            card.background = GradientDrawable().apply {
                cornerRadius = 3.dp.toFloat()
                setColor(color("#fff6e0", "#202e25"))
                setStroke(1.dp, color("#aa9d77", "#586951"))
            }
            name.setTextColor(label)
            title.setTextColor(color("#223a31", "#eef0de"))
            status.setTextColor(color("#4e5c49", "#b7c4ad"))
            spinner.indeterminateTintList = ColorStateList.valueOf(label)
        }
        val heading = "Starting $appName $version"
        if (title.text != heading) title.text = heading
        if (status.text != step) status.text = step
        visibility = VISIBLE
    }
}
