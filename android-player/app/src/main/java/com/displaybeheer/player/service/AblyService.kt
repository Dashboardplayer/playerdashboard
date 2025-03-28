package com.displaybeheer.player.service

import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.displaybeheer.player.PlayerApplication
import com.displaybeheer.player.manager.DeviceManager
import io.ably.lib.realtime.Channel
import io.ably.lib.types.Message
import io.ably.lib.types.ErrorInfo
import io.ably.lib.realtime.CompletionListener
import kotlinx.coroutines.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class AblyService : Service() {
    private lateinit var channel: Channel
    private lateinit var heartbeatJob: Job
    private val coroutineScope = CoroutineScope(Dispatchers.IO + Job())
    private val ablyClient = PlayerApplication.instance.ablyClient
    private val channels = mutableMapOf<String, Channel>()
    private val TAG = "AblyService"
    
    override fun onCreate() {
        super.onCreate()
        setupAblyChannel()
        startHeartbeat()
    }
    
    private fun setupAblyChannel() {
        val playerId = DeviceManager.getMacAddress(this)
        channel = getChannel("player:$playerId")
        
        // Subscribe to commands
        subscribeToCommands("command") { message ->
            handleCommand(message)
        }
        
        // Register player with the server
        registerPlayer()
    }
    
    private fun registerPlayer() {
        val playerId = DeviceManager.getMacAddress(this)
        val registrationData = JSONObject().apply {
            put("playerId", playerId)
            put("status", "online")
            put("type", "registration")
            put("timestamp", System.currentTimeMillis())
            put("deviceInfo", JSONObject().apply {
                put("manufacturer", Build.MANUFACTURER)
                put("model", Build.MODEL)
                put("version", Build.VERSION.RELEASE)
                put("sdkVersion", Build.VERSION.SDK_INT)
            })
        }
        
        try {
            // Send registration to both channels
            val playersChannel = ablyClient.channels.get("players")
            val deviceChannel = ablyClient.channels.get("player:$playerId")
            
            // Register on players channel with explicit CompletionListener implementation
            playersChannel.publish("registration", registrationData.toString(), object : CompletionListener {
                override fun onSuccess() {
                    Log.d(TAG, "Successfully registered player on players channel")
                    // Enter presence after successful registration
                    playersChannel.presence.enter(registrationData.toString(), object : CompletionListener {
                        override fun onSuccess() {
                            Log.d(TAG, "Successfully entered presence")
                        }
                        
                        override fun onError(error: ErrorInfo) {
                            Log.e(TAG, "Failed to enter presence: ${error.message}")
                        }
                    })
                }
                
                override fun onError(error: ErrorInfo) {
                    Log.e(TAG, "Failed to register player: ${error.message}")
                    // Broadcast registration failure using explicit intent
                    val intent = Intent().apply {
                        setClass(applicationContext, Class.forName("com.displaybeheer.player.receiver.ConnectionReceiver"))
                        action = "com.displaybeheer.player.CONNECTION_STATE"
                        putExtra("state", "FAILED")
                        putExtra("message", "Failed to register player: ${error.message}")
                    }
                    sendBroadcast(intent)
                }
            })
            
            // Register on device channel with explicit CompletionListener
            deviceChannel.publish("registration", registrationData.toString(), object : CompletionListener {
                override fun onSuccess() {
                    Log.d(TAG, "Successfully registered player on device channel")
                }
                
                override fun onError(error: ErrorInfo) {
                    Log.e(TAG, "Failed to register on device channel: ${error.message}")
                }
            })
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register player", e)
            // Broadcast registration failure using explicit intent
            val intent = Intent().apply {
                setClass(applicationContext, Class.forName("com.displaybeheer.player.receiver.ConnectionReceiver"))
                action = "com.displaybeheer.player.CONNECTION_STATE"
                putExtra("state", "FAILED")
                putExtra("message", "Failed to register player: ${e.message}")
            }
            sendBroadcast(intent)
        }
    }
    
    private fun startHeartbeat() {
        heartbeatJob = coroutineScope.launch {
            while (isActive) {
                sendHeartbeat()
                delay(TimeUnit.SECONDS.toMillis(30)) // Send heartbeat every 30 seconds
            }
        }
    }
    
    private fun sendHeartbeat() {
        try {
            val heartbeatData = JSONObject().apply {
                put("playerId", DeviceManager.getMacAddress(this@AblyService))
                put("status", "online")  // Simplified status check
                put("type", "heartbeat")
                put("timestamp", System.currentTimeMillis())
            }
            
            channel.publish("heartbeat", heartbeatData.toString(), object : CompletionListener {
                override fun onSuccess() {
                    Log.d(TAG, "Heartbeat sent successfully")
                }
                
                override fun onError(error: ErrorInfo) {
                    Log.e(TAG, "Failed to send heartbeat: ${error.message}")
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Error creating heartbeat", e)
        }
    }
    
    private fun handleCommand(message: Message) {
        try {
            val data = JSONObject(message.data.toString())
            val command = data.getString("command")
            
            when (command) {
                "updateUrl" -> {
                    val url = data.getString("url")
                    val intent = Intent().apply {
                        setClass(applicationContext, Class.forName("com.displaybeheer.player.receiver.CommandReceiver"))
                        action = "com.displaybeheer.player.UPDATE_URL"
                        putExtra("url", url)
                    }
                    sendBroadcast(intent)
                }
                "reboot" -> {
                    DeviceManager.rebootDevice(this)
                }
                "screenshot" -> {
                    val intent = Intent().apply {
                        setClass(applicationContext, Class.forName("com.displaybeheer.player.receiver.CommandReceiver"))
                        action = "com.displaybeheer.player.TAKE_SCREENSHOT"
                    }
                    sendBroadcast(intent)
                }
                "update" -> {
                    val updateUrl = data.getString("updateUrl")
                    val intent = Intent().apply {
                        setClass(applicationContext, Class.forName("com.displaybeheer.player.receiver.CommandReceiver"))
                        action = "com.displaybeheer.player.UPDATE_APK"
                        putExtra("updateUrl", updateUrl)
                    }
                    sendBroadcast(intent)
                }
                else -> {
                    Log.w(TAG, "Unknown command received: $command")
                }
            }
            
            // Send command acknowledgment
            val ackData = JSONObject().apply {
                put("commandId", data.optString("id"))
                put("status", "success")
                put("timestamp", System.currentTimeMillis())
            }
            
            channel.publish("commandAck", ackData.toString(), object : CompletionListener {
                override fun onSuccess() {
                    Log.d(TAG, "Command acknowledgment sent successfully")
                }
                
                override fun onError(error: ErrorInfo) {
                    Log.e(TAG, "Failed to send command acknowledgment: ${error.message}")
                }
            })
            
        } catch (e: Exception) {
            Log.e(TAG, "Error handling command", e)
            try {
                val errorAck = JSONObject().apply {
                    put("commandId", JSONObject(message.data.toString()).optString("id"))
                    put("status", "error")
                    put("error", e.message)
                    put("timestamp", System.currentTimeMillis())
                }
                
                channel.publish("commandAck", errorAck.toString(), object : CompletionListener {
                    override fun onSuccess() {
                        Log.d(TAG, "Error acknowledgment sent successfully")
                    }
                    
                    override fun onError(error: ErrorInfo) {
                        Log.e(TAG, "Failed to send error acknowledgment: ${error.message}")
                    }
                })
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to send error acknowledgment", e2)
            }
        }
    }
    
    fun getChannel(channelName: String): Channel {
        return channels.getOrPut(channelName) {
            ablyClient.channels.get(channelName)
        }
    }
    
    fun subscribeToCommands(channelName: String, onCommand: (Message) -> Unit) {
        try {
            val channel = getChannel(channelName)
            channel.subscribe { message ->
                try {
                    onCommand(message)
                } catch (e: Exception) {
                    Log.e(TAG, "Error in command handler", e)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error subscribing to commands", e)
        }
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        heartbeatJob.cancel()
        coroutineScope.cancel()
        channel.detach()
    }
} 