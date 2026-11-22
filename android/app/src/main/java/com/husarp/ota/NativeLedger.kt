package com.husarp.ota

import android.app.AlertDialog
import android.content.Context
import android.content.res.Configuration
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.ContextThemeWrapper
import android.widget.TextView
import androidx.core.content.res.ResourcesCompat
import com.husarp.linebreaker.R

internal object NativeLedger {
    private fun preferences(context: Context) = context.getSharedPreferences("ledger-appearance", Context.MODE_PRIVATE)
    fun light(context: Context): Boolean = preferences(context).getBoolean("light", false)
    fun setLight(context: Context, light: Boolean) = preferences(context).edit().putBoolean("light", light).apply()
    private fun style(context: Context) = if (light(context)) R.style.LedgerShellLight else R.style.LedgerShell
    fun context(base: Context): Context = ContextThemeWrapper(base, style(base)).apply {
        applyOverrideConfiguration(Configuration().apply {
            uiMode = if (light(base)) Configuration.UI_MODE_NIGHT_NO else Configuration.UI_MODE_NIGHT_YES
        })
    }
    fun label(context: Context): Int = context.getColor(R.color.lb_ledger_label)
    fun panel(context: Context) = GradientDrawable().apply {
        val density = context.resources.displayMetrics.density
        cornerRadius = 3 * density
        setColor(context.getColor(R.color.lb_ledger_panel))
        setStroke(density.toInt().coerceAtLeast(1), context.getColor(R.color.lb_ledger_edge))
    }

    fun heading(context: Context): Typeface = runCatching {
        ResourcesCompat.getFont(context, R.font.lb_silkscreen)
    }.getOrNull() ?: Typeface.DEFAULT_BOLD

    fun title(context: Context, label: String, warning: Boolean = false) = TextView(context).apply {
        text = label
        textSize = 18f
        typeface = heading(context)
        setTextColor(if (warning) context.getColor(R.color.lb_ledger_danger) else NativeLedger.label(context))
        val margin = (20 * resources.displayMetrics.density).toInt()
        setPadding(margin, margin, margin, margin / 2)
    }

    fun dialog(context: Context) = AlertDialog.Builder(context, style(context))

    fun dialog(context: Context, label: String, warning: Boolean = false) = dialog(context)
        .setCustomTitle(title(context, label, warning))
}
