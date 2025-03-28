package com.displaybeheer.player.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class ConnectionReceiver : BroadcastReceiver() {
    private val tag = "ConnectionReceiver"

    override fun onReceive(context: Context?, intent: Intent?) {
        Log.d(tag, "Received connection state: ${intent?.action}")
        when (intent?.action) {
            "com.displaybeheer.player.CONNECTION_STATE" -> {
                val state = intent.getStringExtra("state")
                val message = intent.getStringExtra("message")
                Log.d(tag, "Connection state changed: $state, message: $message")
                // Forward to MainActivity
                context?.sendBroadcast(Intent("com.displaybeheer.player.INTERNAL_CONNECTION_STATE")
                    .putExtra("state", state)
                    .putExtra("message", message))
            }
        }
    }
} 