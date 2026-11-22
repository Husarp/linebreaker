package com.husarp.ota

import android.app.AlertDialog
import android.content.Context
import android.graphics.Typeface
import android.view.ContextThemeWrapper
import android.widget.TextView
import com.husarp.linebreaker.R

internal object NativeLedger {
    fun context(base: Context): Context = ContextThemeWrapper(base, R.style.LedgerShell)

    fun heading(context: Context): Typeface = runCatching {
        Typeface.createFromAsset(context.assets, "public/assets/fonts/Silkscreen-Latin.woff2")
    }.recoverCatching {
        Typeface.createFromAsset(context.assets, "public/assets/fonts/PressStart2P-Regular.ttf")
    }.getOrDefault(Typeface.MONOSPACE)

    fun title(context: Context, label: String) = TextView(context).apply {
        text = label
        textSize = 18f
        typeface = heading(context)
        setTextColor(context.getColor(R.color.lb_ledger_label))
        val margin = (20 * resources.displayMetrics.density).toInt()
        setPadding(margin, margin, margin, margin / 2)
    }

    fun dialog(context: Context) = AlertDialog.Builder(context, R.style.LedgerShell)

    fun dialog(context: Context, label: String) = dialog(context)
        .setCustomTitle(title(context, label))
}
