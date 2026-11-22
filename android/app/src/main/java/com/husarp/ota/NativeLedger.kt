package com.husarp.ota

import android.app.AlertDialog
import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.ContextThemeWrapper
import android.widget.TextView
import com.husarp.linebreaker.R

internal object NativeLedger {
    private fun preferences(context: Context) = context.getSharedPreferences("circuit-appearance", Context.MODE_PRIVATE)
    fun green(context: Context): Boolean = preferences(context).getBoolean("green", false)
    fun setGreen(context: Context, green: Boolean) = preferences(context).edit().putBoolean("green", green).apply()
    private fun style(context: Context) = if (green(context)) R.style.LedgerShell_Green else R.style.LedgerShell
    fun context(base: Context): Context = ContextThemeWrapper(base, style(base))
    fun label(context: Context): Int = context.getColor(if (green(context)) R.color.lb_circuit_green_label else R.color.lb_ledger_label)
    fun panel(context: Context) = GradientDrawable().apply {
        val density = context.resources.displayMetrics.density
        cornerRadius = 7 * density
        setColor(context.getColor(R.color.lb_ledger_panel))
        setStroke(density.toInt().coerceAtLeast(1), context.getColor(R.color.lb_circuit_edge))
    }

    fun heading(context: Context): Typeface = runCatching {
        Typeface.createFromAsset(context.assets, "public/assets/fonts/Orbitron-VariableFont_wght.ttf")
    }.map { Typeface.create(it, Typeface.BOLD) }.getOrDefault(Typeface.DEFAULT_BOLD)

    fun title(context: Context, label: String, warning: Boolean = false) = TextView(context).apply {
        text = label
        textSize = 18f
        typeface = heading(context)
        setTextColor(if (warning) context.getColor(R.color.lb_circuit_danger) else NativeLedger.label(context))
        val margin = (20 * resources.displayMetrics.density).toInt()
        setPadding(margin, margin, margin, margin / 2)
    }

    fun dialog(context: Context) = AlertDialog.Builder(context, style(context))

    fun dialog(context: Context, label: String, warning: Boolean = false) = dialog(context)
        .setCustomTitle(title(context, label, warning))
}
