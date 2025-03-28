package com.displaybeheer.player.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class CommandReceiver : BroadcastReceiver() {
    private val tag = "CommandReceiver"

    override fun onReceive(context: Context?, intent: Intent?) {
        Log.d(tag, "Received command: ${intent?.action}")
        when (intent?.action) {
            "com.displaybeheer.player.UPDATE_URL" -> {
                val url = intent.getStringExtra("url")
                Log.d(tag, "Update URL command received: $url")
                // Forward to MainActivity
                context?.sendBroadcast(Intent("com.displaybeheer.player.INTERNAL_UPDATE_URL")
                    .putExtra("url", url))
            }
            "com.displaybeheer.player.TAKE_SCREENSHOT" -> {
                Log.d(tag, "Take screenshot command received")
                // Forward to MainActivity
                context?.sendBroadcast(Intent("com.displaybeheer.player.INTERNAL_TAKE_SCREENSHOT"))
            }
            "com.displaybeheer.player.UPDATE_APK" -> {
                val updateUrl = intent.getStringExtra("updateUrl")
                Log.d(tag, "Update APK command received: $updateUrl")
                // Forward to MainActivity
                context?.sendBroadcast(Intent("com.displaybeheer.player.INTERNAL_UPDATE_APK")
                    .putExtra("updateUrl", updateUrl))
            }
        }
    }
} 