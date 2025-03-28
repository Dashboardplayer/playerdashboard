package com.displaybeheer.player.service

import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.displaybeheer.player.BuildConfig
import com.displaybeheer.player.PlayerApplication
import com.displaybeheer.player.service.AblyService
import io.ably.lib.realtime.AblyRealtime
import io.ably.lib.rest.Auth
import org.json.JSONObject

class PlayerService : Service() {
    private val TAG = "PlayerService"
    private lateinit var ablyService: AblyService
    private lateinit var localBroadcastManager: LocalBroadcastManager
    private var isAblyConnected = false
    private var pendingUrl: String? = null
    private lateinit var broadcastReceiver: BroadcastReceiver

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "PlayerService created")
        
        localBroadcastManager = LocalBroadcastManager.getInstance(this)
        
        // Start Ably service with retry mechanism
        startAblyService()

        // Initialize broadcast receiver
        broadcastReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    Intent.ACTION_SCREEN_ON -> {
                        Log.d(TAG, "Screen turned on")
                        // Handle screen on event
                    }
                    Intent.ACTION_SCREEN_OFF -> {
                        Log.d(TAG, "Screen turned off")
                        // Handle screen off event
                    }
                }
            }
        }

        // Register receiver with proper flags
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
        }
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            registerReceiver(broadcastReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(broadcastReceiver, filter)
        }
    }

    private fun startAblyService() {
        Log.d(TAG, "Starting Ably service")
        startService(Intent(this, AblyService::class.java))
        
        // Wait for Ably service to be ready
        Handler(Looper.getMainLooper()).postDelayed({
            initializeAblyService()
        }, 1000)
    }

    private fun initializeAblyService() {
        try {
            Log.d(TAG, "Initializing Ably service")
            ablyService = AblyService()
            setupUpdateProgressReceiver()
            
            // Send initial connection status
            sendConnectionState("CONNECTING", "Initializing connection...")
            
            // Register connection state receiver
            val filter = IntentFilter("com.displaybeheer.player.CONNECTION_STATE")
            localBroadcastManager.registerReceiver(object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    val state = intent?.getStringExtra("state")
                    val message = intent?.getStringExtra("message")
                    
                    when (state) {
                        "CONNECTED" -> {
                            isAblyConnected = true
                            Log.d(TAG, "Ably connected, loading initial URL")
                            loadInitialUrl()
                        }
                        "FAILED" -> {
                            isAblyConnected = false
                            Log.e(TAG, "Ably connection failed: $message")
                            // Retry connection after delay
                            Handler(Looper.getMainLooper()).postDelayed({
                                startAblyService()
                            }, 5000)
                        }
                    }
                }
            }, filter)
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Ably service", e)
            sendConnectionState("FAILED", "Failed to initialize Ably: ${e.message}")
            
            // Retry after delay
            Handler(Looper.getMainLooper()).postDelayed({
                startAblyService()
            }, 5000)
        }
    }

    private fun loadInitialUrl() {
        val url = pendingUrl ?: BuildConfig.API_BASE_URL
        Log.d(TAG, "Loading initial URL: $url")
        sendUrlUpdate(url)
    }

    private fun sendUrlUpdate(url: String) {
        val intent = Intent("com.displaybeheer.player.UPDATE_URL")
            .putExtra("url", url)
        localBroadcastManager.sendBroadcast(intent)
    }

    private fun sendConnectionState(state: String, message: String?) {
        val intent = Intent("com.displaybeheer.player.CONNECTION_STATE")
            .putExtra("state", state)
            .putExtra("message", message)
        localBroadcastManager.sendBroadcast(intent)
    }

    private fun setupUpdateProgressReceiver() {
        val filter = IntentFilter("com.displaybeheer.player.UPDATE_PROGRESS")
        localBroadcastManager.registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val progress = intent?.getIntExtra("progress", 0) ?: 0
                Log.d(TAG, "Update progress: $progress%")
            }
        }, filter)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "PlayerService started")
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(broadcastReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receiver", e)
        }
        Log.d(TAG, "PlayerService destroyed")
    }
} 