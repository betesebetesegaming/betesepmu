package com.betese.pmu.benchmark

import android.content.Intent
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MacrobenchmarkRule
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    private val targetPackage: String
        get() = InstrumentationRegistry.getArguments()
            .getString("targetPackage", "com.betese.pmu")

    private fun benchmark(startupMode: StartupMode) {
        benchmarkRule.measureRepeated(
            packageName = targetPackage,
            metrics = listOf(StartupTimingMetric(), FrameTimingMetric()),
            iterations = 8,
            startupMode = startupMode,
            setupBlock = {
                pressHome()
            }
        ) {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                setPackage(targetPackage)
            }
            startActivityAndWait(intent)
        }
    }

    @Test
    fun startupCold() = benchmark(StartupMode.COLD)

    @Test
    fun startupWarm() = benchmark(StartupMode.WARM)
}
