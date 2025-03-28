package com.displaybeheer.player.api

import android.content.Context
import android.util.Log
import com.displaybeheer.player.BuildConfig
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class ApiClient(private val context: Context) {
    private val client = OkHttpClient()
    private val baseUrl = "https://displaybeheer-server.onrender.com"
    private val apiKey = BuildConfig.APPETIZE_API

    fun getDashboardData(callback: (String?, Exception?) -> Unit) {
        val request = Request.Builder()
            .url("$baseUrl/api/dashboard")
            .addHeader("Authorization", "Bearer $apiKey")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("ApiClient", "API call failed", e)
                callback(null, e)
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    callback(responseBody, null)
                } else {
                    val error = Exception("API call failed with code: ${response.code}")
                    Log.e("ApiClient", "API call failed", error)
                    callback(null, error)
                }
            }
        })
    }

    fun registerDevice(deviceId: String, callback: (Boolean, Exception?) -> Unit) {
        val json = JSONObject().apply {
            put("deviceId", deviceId)
        }

        val requestBody = json.toString().toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("$baseUrl/api/register-device")
            .addHeader("Authorization", "Bearer $apiKey")
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("ApiClient", "Device registration failed", e)
                callback(false, e)
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    callback(true, null)
                } else {
                    val error = Exception("Device registration failed with code: ${response.code}")
                    Log.e("ApiClient", "Device registration failed", error)
                    callback(false, error)
                }
            }
        })
    }
} 