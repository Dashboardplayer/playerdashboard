package com.displaybeheer.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.displaybeheer.player.service.PlayerService
import com.displaybeheer.player.service.UpdateService
import com.displaybeheer.player.manager.DeviceManager
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import android.net.http.SslError
import androidx.core.graphics.createBitmap

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val tag = "MainActivity"
    private var isPageLoaded = false
    private var retryCount = 0
    private val maxRetries = 3
    private var connectionTimeoutHandler: android.os.Handler? = null
    private val connectionTimeoutRunnable = Runnable {
        if (!isPageLoaded) {
            Log.e(tag, "Connection timeout - no response received")
            handleLoadError(webView, "Connection timeout - server not responding")
        }
    }
    
    private val serverUrl = "https://displaybeheer-server.onrender.com/"  // Single source of truth
    
    private val connectionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                "com.displaybeheer.player.INTERNAL_CONNECTION_STATE" -> {
                    val state = intent.getStringExtra("state")
                    val message = intent.getStringExtra("message")
                    showConnectionStatus(state, message)
                }
            }
        }
    }

    private val commandReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                "com.displaybeheer.player.INTERNAL_UPDATE_URL" -> {
                    val url = intent.getStringExtra("url")
                    url?.let { webView.loadUrl(it) }
                }
                "com.displaybeheer.player.INTERNAL_TAKE_SCREENSHOT" -> {
                    takeScreenshot()
                }
                "com.displaybeheer.player.INTERNAL_UPDATE_APK" -> {
                    val updateUrl = intent.getStringExtra("updateUrl")
                    updateUrl?.let { startApkUpdate(it) }
                }
            }
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Start services
        startService(Intent(this, PlayerService::class.java))
        startService(Intent(this, UpdateService::class.java))
        
        // Configure WebView with improved settings
        webView = findViewById(R.id.webView)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowContentAccess = true
            allowFileAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            mediaPlaybackRequiresUserGesture = false
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_NO_CACHE
            
            // Additional settings for Appetize.io compatibility
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }
            
            // Enable debugging in WebView
            WebView.setWebContentsDebuggingEnabled(true)
            
            // Add timeout settings
            setRenderPriority(WebSettings.RenderPriority.HIGH)
            setCacheMode(WebSettings.LOAD_NO_CACHE)
            
            // Additional security settings
            allowUniversalAccessFromFileURLs = true
            allowFileAccessFromFileURLs = true
            allowContentAccess = true
            allowFileAccess = true
            allowUniversalAccessFromFileURLs = true
            allowFileAccessFromFileURLs = true
        }

        // Add WebChromeClient for console messages
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.d(tag, "Console: ${message.message()} at ${message.sourceId()}:${message.lineNumber()}")
                return true
            }
            
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                Log.d(tag, "Loading progress: $newProgress%")
            }
        }

        // Add improved error handling
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    val errorMessage = "WebView error: ${error?.description} for URL: ${request?.url}"
                    Log.e(tag, errorMessage)
                    
                    if (request?.isForMainFrame == true) {
                        handleLoadError(view, errorMessage)
                    }
                }
            }
            
            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                super.onReceivedHttpError(view, request, errorResponse)
                val errorMessage = "HTTP Error: ${errorResponse?.statusCode} for URL: ${request?.url}"
                Log.e(tag, errorMessage)
                
                if (request?.isForMainFrame == true) {
                    when (errorResponse?.statusCode) {
                        503 -> {
                            // Server is temporarily unavailable, implement exponential backoff
                            val delayMs = (Math.pow(2.0, retryCount.toDouble()) * 1000).toLong()
                            Log.d(tag, "Server unavailable (503), retrying in ${delayMs}ms")
                            view?.postDelayed({
                                loadInitialUrl()
                            }, delayMs)
                        }
                        else -> handleLoadError(view, errorMessage)
                    }
                }
            }
            
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                val errorMessage = "SSL Error: ${error?.primaryError} for URL: ${error?.url}"
                Log.e(tag, errorMessage)
                // Always proceed with SSL errors in Appetize.io
                handler?.proceed()
            }
            
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.d(tag, "Loading URL: $url")
                showConnectionStatus("CONNECTING", "Loading $url...")
                
                // Start connection timeout
                connectionTimeoutHandler?.removeCallbacks(connectionTimeoutRunnable)
                connectionTimeoutHandler = android.os.Handler(android.os.Looper.getMainLooper())
                connectionTimeoutHandler?.postDelayed(connectionTimeoutRunnable, 30000) // 30 second timeout
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(tag, "Finished loading: $url")
                
                // Cancel connection timeout
                connectionTimeoutHandler?.removeCallbacks(connectionTimeoutRunnable)
                
                if (!url.isNullOrEmpty() && !url.startsWith("data:")) {
                    isPageLoaded = true
                    showConnectionStatus("CONNECTED", "Connected to $url")
                    retryCount = 0  // Reset retry count on successful load
                    
                    // Only try to register if not on dashboard
                    if (!url.contains("superadmin-dashboard")) {
                        registerDevice()
                    }
                }
            }
        }
        
        // Start loading the server URL
        loadInitialUrl()
        
        // Register receivers
        registerReceiver(commandReceiver, IntentFilter().apply {
            addAction("com.displaybeheer.player.INTERNAL_UPDATE_URL")
            addAction("com.displaybeheer.player.INTERNAL_TAKE_SCREENSHOT")
            addAction("com.displaybeheer.player.INTERNAL_UPDATE_APK")
        })

        registerReceiver(connectionReceiver, IntentFilter().apply {
            addAction("com.displaybeheer.player.INTERNAL_CONNECTION_STATE")
        })
    }
    
    private fun showConnectionStatus(state: String?, message: String?) {
        isPageLoaded = state == "CONNECTED"
        runOnUiThread {
            val status = when (state) {
                "CONNECTED" -> "Connected to server"
                "CONNECTING" -> "Connecting to server..."
                "FAILED" -> "Connection failed: $message"
                "DISCONNECTED" -> "Disconnected: $message"
                else -> "Unknown state: $state"
            }
            
            // Show a more visible error message with debugging info
            val backgroundColor = when (state) {
                "CONNECTED" -> "#28a745"  // Green
                "CONNECTING" -> "#ffc107"  // Yellow
                "FAILED", "DISCONNECTED" -> "#dc3545"  // Red
                else -> "#6c757d"  // Gray
            }
            
            val debugInfo = """
                <html>
                    <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa;">
                        <div style="text-align: center; padding: 20px;">
                            <div style="background-color: $backgroundColor; color: white; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                                <strong>Connection Status:</strong> $state
                            </div>
                            <h3 style="color: #343a40;">Debug Information</h3>
                            <p style="color: #6c757d;">Status: $status</p>
                            <p style="color: #6c757d; font-size: 0.9em;">Message: $message</p>
                            <p style="color: #6c757d; font-size: 0.8em;">Time: ${System.currentTimeMillis()}</p>
                            <p style="color: #6c757d; font-size: 0.8em;">API URL: ${BuildConfig.API_BASE_URL}</p>
                            <div style="margin-top: 10px; padding: 10px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;">
                                <p style="color: #721c24; font-size: 0.9em;">
                                    <strong>Development Note:</strong><br>
                                    Make sure your local server is running at port 5001<br>
                                    The app is connecting to your computer at: ${BuildConfig.API_BASE_URL}
                                </p>
                            </div>
                            <div style="margin-top: 20px;">
                                <button onclick="window.location.reload()" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                    Retry Connection
                                </button>
                            </div>
                        </div>
                    </body>
                </html>
            """.trimIndent()
            
            if (state != "CONNECTED") {
                webView.loadData(debugInfo, "text/html", "UTF-8")
            }
            
            Log.d(tag, "Connection status: $status")
            Toast.makeText(this, status, Toast.LENGTH_LONG).show()
        }
    }

    private fun showError(message: String) {
        runOnUiThread {
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }

    private fun takeScreenshot() {
        webView.post {
            try {
                // Create bitmap of the WebView's dimensions using KTX
                val bitmap = createBitmap(
                    webView.width,
                    webView.height,
                    Bitmap.Config.ARGB_8888
                )
                
                // Draw the WebView into the bitmap
                val canvas = android.graphics.Canvas(bitmap)
                webView.draw(canvas)
                
                val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
                val fileName = "screenshot_$timestamp.jpg"
                val file = File(getExternalFilesDir(null), fileName)
                
                try {
                    FileOutputStream(file).use { out ->
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 100, out)
                    }
                    // Send broadcast to notify screenshot is ready
                    val intent = Intent("com.displaybeheer.player.SCREENSHOT_READY")
                    intent.putExtra("screenshotPath", file.absolutePath)
                    sendBroadcast(intent)
                    showConnectionStatus("INFO", "Screenshot saved")
                } catch (e: Exception) {
                    e.printStackTrace()
                    showError("Failed to take screenshot: ${e.message}")
                }
            } catch (e: Exception) {
                Log.e(tag, "Failed to create screenshot", e)
                showError("Failed to create screenshot: ${e.message}")
            }
        }
    }
    
    private fun startApkUpdate(updateUrl: String) {
        val intent = Intent(this, UpdateService::class.java)
        intent.putExtra("updateUrl", updateUrl)
        startService(intent)
    }
    
    private fun loadInitialUrl() {
        Log.d(tag, "Loading initial URL: $serverUrl")
        // First try to load the root URL to establish connection
        webView.loadUrl(serverUrl)
        
        // After a short delay, try to load the dashboard if we're not already there
        webView.postDelayed({
            val currentUrl = webView.url
            if (!currentUrl.isNullOrEmpty() && !currentUrl.contains("superadmin-dashboard")) {
                Log.d(tag, "Attempting to load dashboard after initial connection")
                webView.loadUrl("${serverUrl}superadmin-dashboard")
            }
        }, 2000) // 2 second delay
    }
    
    private fun handleLoadError(view: WebView?, error: String) {
        Log.e(tag, "Load error: $error")
        showConnectionStatus("FAILED", error)
        
        if (retryCount < maxRetries) {
            retryCount++
            val delayMs = (Math.pow(2.0, retryCount.toDouble()) * 1000).toLong()
            view?.postDelayed({
                loadInitialUrl()
            }, delayMs)
        } else {
            retryCount = 0
            showConnectionStatus("FAILED", "Could not connect to server after multiple attempts")
        }
        
        // Show error page with retry button
        val errorHtml = """
            <html>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8f9fa;">
                    <div style="text-align: center; padding: 20px;">
                        <div style="background-color: #dc3545; color: white; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                            <strong>Connection Error</strong>
                        </div>
                        <h3 style="color: #343a40;">Error Details</h3>
                        <p style="color: #6c757d;">$error</p>
                        <p style="color: #6c757d;">Server: $serverUrl</p>
                        <p style="color: #6c757d;">Attempt: $retryCount of $maxRetries</p>
                        <button onclick="window.location.href='$serverUrl'" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Retry Connection
                        </button>
                    </div>
                </body>
            </html>
        """.trimIndent()
        
        view?.loadData(errorHtml, "text/html", "UTF-8")
    }
    
    private fun registerDevice() {
        val deviceId = DeviceManager.getMacAddress(this) ?: return
        val registerScript = """
            try {
                if (typeof window.registerNewPlayer === 'function') {
                    window.registerNewPlayer('${deviceId.replace("'", "\\'")}');
                } else {
                    console.log('registerNewPlayer function not found, navigating to dashboard');
                    window.location.href = '${serverUrl}superadmin-dashboard';
                }
            } catch (e) {
                console.error('Failed to register device:', e);
                window.location.href = '${serverUrl}superadmin-dashboard';
            }
        """.trimIndent()
        
        webView.evaluateJavascript(registerScript) { result ->
            Log.d(tag, "Register device result: $result")
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(commandReceiver)
        unregisterReceiver(connectionReceiver)
    }
} 