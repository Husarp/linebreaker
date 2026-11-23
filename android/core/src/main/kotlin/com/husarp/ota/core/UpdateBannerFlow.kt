package com.husarp.ota.core

enum class UpdateBannerPhase { AVAILABLE, DOWNLOADING, READY, INSTALLING }

data class UpdateBannerStep(val target: String, val phase: UpdateBannerPhase)

class UpdateBannerFlow<Item>(private val step: (Item) -> UpdateBannerStep?) {
    private var active: Item? = null

    fun clear() { active = null }

    fun select(items: List<Item>, failed: (UpdateBannerStep) -> Boolean = { false }, preferred: Item? = null): Item? {
        val previous = active?.let(step)
        val installing = items.firstOrNull { step(it)?.phase == UpdateBannerPhase.INSTALLING }
        val next = when {
            installing != null -> installing
            previous != null && previous.phase > UpdateBannerPhase.AVAILABLE && !failed(previous) ->
                items.filter { step(it)?.target == previous.target && step(it)!!.phase >= previous.phase }
                    .maxByOrNull { step(it)!!.phase } ?: active
            else -> items.filter { step(it)?.let { phase -> phase.phase > UpdateBannerPhase.AVAILABLE && !failed(phase) } == true }
                .maxByOrNull { step(it)!!.phase } ?: preferred ?: items.firstOrNull()
        }
        active = next
        return next
    }

    companion object {
        fun nativeOwns(webOwns: Boolean?, maintenance: Boolean) = webOwns == false || (webOwns == null && maintenance)
    }
}
