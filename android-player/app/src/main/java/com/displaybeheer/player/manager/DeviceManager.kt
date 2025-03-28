package com.displaybeheer.player.manager

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import java.util.*

object DeviceManager {
    private const val TAG = "DeviceManager"
    private const val DEVICE_ID_PREF = "device_id_pref"
    private const val DEVICE_ID_KEY = "device_id"

    fun getMacAddress(context: Context): String {
        // Try to get stored device ID first
        val prefs = context.getSharedPreferences(DEVICE_ID_PREF, Context.MODE_PRIVATE)
        var deviceId = prefs.getString(DEVICE_ID_KEY, null)

        if (deviceId == null) {
            // Generate a new device ID using multiple sources
            val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            val timestamp = System.currentTimeMillis()
            val random = Random().nextInt(10000)
            
            deviceId = "player_${androidId}_${timestamp}_$random"
            
            // Store the generated device ID
            prefs.edit().putString(DEVICE_ID_KEY, deviceId).apply()
            Log.d(TAG, "Generated new device ID: $deviceId")
        } else {
            Log.d(TAG, "Using stored device ID: $deviceId")
        }
        
        return deviceId
    }
    
    fun rebootDevice(context: Context) {
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            powerManager.reboot(null) // Requires REBOOT permission
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reboot device: ${e.message}")
            e.printStackTrace()
        }
    }
    
    fun isOnline(context: Context): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(network)
        
        val isOnline = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        Log.d(TAG, "Device online status: $isOnline")
        return isOnline
    }
} 