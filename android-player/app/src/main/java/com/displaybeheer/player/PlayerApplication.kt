package com.displaybeheer.player

import android.app.Application
import android.content.Intent
import android.util.Log
import com.displaybeheer.player.BuildConfig
import com.displaybeheer.player.manager.DeviceManager
import io.ably.lib.realtime.AblyRealtime
import io.ably.lib.realtime.Channel
import io.ably.lib.types.ClientOptions
import io.ably.lib.types.Message
import io.ably.lib.realtime.CompletionListener
import io.ably.lib.types.ErrorInfo
import io.ably.lib.realtime.ConnectionState
import io.ably.lib.realtime.ConnectionStateListener
import io.ably.lib.realtime.ConnectionEvent
import org.json.JSONObject

class PlayerApplication : Application() {
    lateinit var ablyClient: AblyRealtime
    
    companion object {
        lateinit var instance: PlayerApplication
            private set
        private const val TAG = "PlayerApplication"
    }
    
    override fun onCreate() {
        super.onCreate()
        instance = this
        
        // Initialize Ably with device ID
        val deviceId = DeviceManager.getMacAddress(this)
        Log.d(TAG, "Device ID: $deviceId")
        
        val clientOptions = ClientOptions().apply {
            key = BuildConfig.ABLY_API_KEY
            clientId = deviceId
        }
        
        try {
            ablyClient = AblyRealtime(clientOptions)
            
            // Add connection state listener with enhanced logging
            ablyClient.connection.on { state ->
                val stateMessage = when (state.current) {
                    ConnectionState.initialized -> "Initialized - SDK instantiated"
                    ConnectionState.connecting -> "Connecting - Attempting to connect"
                    ConnectionState.connected -> "Connected successfully"
                    ConnectionState.disconnected -> "Disconnected - Connection dropped but will retry"
                    ConnectionState.suspended -> "Suspended - Multiple failed connection attempts"
                    ConnectionState.closing -> "Closing - Connection is closing"
                    ConnectionState.closed -> "Closed - Connection is closed"
                    ConnectionState.failed -> "Failed - Unrecoverable failure"
                    else -> "Unknown state"
                }
                
                Log.d(TAG, "Ably connection state changed to: $stateMessage")
                Log.d(TAG, "Previous state was: ${state.previous}")
                
                if (state.reason != null) {
                    Log.e(TAG, "State change reason: ${state.reason?.message}")
                    Log.e(TAG, "Error code: ${state.reason?.code}")
                    Log.e(TAG, "Status code: ${state.reason?.statusCode}")
                    Log.e(TAG, "Error details: ${state.reason?.toString()}")
                }
                
                when (state.current) {
                    ConnectionState.connected -> {
                        Log.i(TAG, "Successfully connected to Ably")
                        setupChannels(deviceId)
                    }
                    ConnectionState.failed -> {
                        Log.e(TAG, "Connection failed: ${state.reason?.message}")
                        // Broadcast connection failure
                        sendBroadcast(Intent("com.displaybeheer.player.CONNECTION_STATE")
                            .putExtra("state", "FAILED")
                            .putExtra("message", state.reason?.message))
                    }
                    ConnectionState.disconnected -> {
                        Log.w(TAG, "Disconnected: ${state.reason?.message}")
                        // Broadcast disconnection
                        sendBroadcast(Intent("com.displaybeheer.player.CONNECTION_STATE")
                            .putExtra("state", "DISCONNECTED")
                            .putExtra("message", state.reason?.message))
                    }
                    else -> Log.d(TAG, "Connection state: ${state.current}")
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Ably", e)
            Log.e(TAG, "Stack trace: ${e.stackTraceToString()}")
            // Broadcast initialization failure
            sendBroadcast(Intent("com.displaybeheer.player.CONNECTION_STATE")
                .putExtra("state", "FAILED")
                .putExtra("message", "Failed to initialize Ably: ${e.message}"))
        }
    }
    
    private fun setupChannels(deviceId: String) {
        try {
            // Connect to both the general players channel and the device-specific channel
            val playersChannel = ablyClient.channels.get("players")
            val deviceChannel = ablyClient.channels.get("player:$deviceId")
            
            Log.d(TAG, "Setting up channels - players and player:$deviceId")
            
            // Enter presence with device info on the general channel
            val presenceData = JSONObject().apply {
                put("deviceId", deviceId)
                put("status", "online")
                put("lastSeen", System.currentTimeMillis())
                put("type", "player")
            }
            
            // Enter presence with explicit CompletionListener
            playersChannel.presence.enter(presenceData.toString(), object : CompletionListener {
                override fun onSuccess() {
                    Log.d(TAG, "Successfully entered presence with deviceId: $deviceId")
                }
                
                override fun onError(error: ErrorInfo) {
                    Log.e(TAG, "Failed to enter presence: ${error.message}")
                    Log.e(TAG, "Error code: ${error.code}, statusCode: ${error.statusCode}")
                }
            })
            
            // Subscribe to the device-specific channel for commands
            deviceChannel.subscribe("command", object : Channel.MessageListener {
                override fun onMessage(message: Message) {
                    Log.d(TAG, "Received command message: ${message.data}")
                    try {
                        val commandData = JSONObject(message.data.toString())
                        val commandType = commandData.getString("type")
                        val payload = commandData.optJSONObject("payload") ?: JSONObject()
                        
                        Log.d(TAG, "Processing command type: $commandType")
                        
                        // Handle command
                        when (commandType) {
                            "updateUrl" -> {
                                val url = payload.getString("url")
                                Log.d(TAG, "Updating URL to: $url")
                                sendBroadcast(Intent("com.displaybeheer.player.UPDATE_URL")
                                    .putExtra("url", url))
                            }
                            "reboot" -> {
                                Log.d(TAG, "Executing reboot command")
                                DeviceManager.rebootDevice(this@PlayerApplication)
                            }
                            "screenshot" -> {
                                Log.d(TAG, "Taking screenshot")
                                sendBroadcast(Intent("com.displaybeheer.player.TAKE_SCREENSHOT"))
                            }
                            "update" -> {
                                val updateUrl = payload.getString("url")
                                Log.d(TAG, "Updating APK from: $updateUrl")
                                sendBroadcast(Intent("com.displaybeheer.player.UPDATE_APK")
                                    .putExtra("updateUrl", updateUrl))
                            }
                            "systemUpdate" -> {
                                val updateUrl = payload.getString("url")
                                Log.d(TAG, "System update from: $updateUrl")
                                sendBroadcast(Intent("com.displaybeheer.player.SYSTEM_UPDATE")
                                    .putExtra("updateUrl", updateUrl))
                            }
                        }
                        
                        // Send acknowledgment
                        val ackData = JSONObject().apply {
                            put("commandId", commandData.optString("id"))
                            put("status", "success")
                            put("timestamp", System.currentTimeMillis())
                        }
                        deviceChannel.publish("commandAck", ackData.toString())
                        Log.d(TAG, "Sent command acknowledgment")
                        
                    } catch (e: Exception) {
                        Log.e(TAG, "Error handling command: ${e.message}")
                        e.printStackTrace()
                        // Send error acknowledgment
                        val errorData = JSONObject().apply {
                            put("commandId", JSONObject(message.data.toString()).optString("id"))
                            put("status", "error")
                            put("error", e.message)
                            put("timestamp", System.currentTimeMillis())
                        }
                        deviceChannel.publish("commandAck", errorData.toString())
                    }
                }
            })
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to setup channels: ${e.message}")
            e.printStackTrace()
        }
    }
} 