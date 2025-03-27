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
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import android.net.http.SslError
import androidx.core.graphics.createBitmap

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val tag = "MainActivity"
    
    private val serverUrls = listOf(
        BuildConfig.API_BASE_URL,        // Default URL (10.0.2.2:5001)
        "http://localhost:5001/",        // Local URL
        "http://172.26.96.1:5001/"      // Network URL
    )
    private var currentUrlIndex = 0

    private val connectionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                "com.displaybeheer.player.CONNECTION_STATE" -> {
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
                "com.displaybeheer.player.UPDATE_URL" -> {
                    val url = intent.getStringExtra("url")
                    url?.let { webView.loadUrl(it) }
                }
                "com.displaybeheer.player.TAKE_SCREENSHOT" -> {
                    takeScreenshot()
                }
                "com.displaybeheer.player.UPDATE_APK" -> {
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
        
        // Configure WebView
        webView = findViewById(R.id.webView)
        webView.settings.apply {
            // Enable JavaScript with security measures
            javaScriptEnabled = true  // Required for modern web apps
            
            // Development settings
            if (BuildConfig.DEBUG) {
                // Enable remote debugging
                WebView.setWebContentsDebuggingEnabled(true)
                // Allow mixed content in development
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }
            } else {
                // Production settings
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                }
            }
            
            // Enable necessary modern web features
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(false)
            
            // Enable modern web features with restrictions
            allowContentAccess = true
            allowFileAccess = true
            
            // Enable modern rendering
            useWideViewPort = true
            loadWithOverviewMode = true
            mediaPlaybackRequiresUserGesture = false  // Allow media autoplay in development
            
            // Enable modern web APIs with restrictions
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            
            // Cache settings for better offline support
            cacheMode = WebSettings.LOAD_NO_CACHE  // Disable cache during development
        }

        // Add Chrome client for console messages
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.d(tag, "Console: ${message.message()} at ${message.sourceId()}:${message.lineNumber()}")
                return true
            }
        }

        // Add security headers
        webView.settings.userAgentString = "${webView.settings.userAgentString}; DisplayBeheerPlayer"
        
        // Content Security Policy
        val csp = "default-src 'self' http://10.0.2.2:5001 https://io.ably.io; " +
                 "script-src 'self' 'unsafe-inline' http://10.0.2.2:5001; " +
                 "style-src 'self' 'unsafe-inline'; " +
                 "img-src 'self' data: http://10.0.2.2:5001; " +
                 "connect-src 'self' http://10.0.2.2:5001 https://io.ably.io;"
                 
        webView.webViewClient = object : WebViewClient() {
            private var retryCount = 0
            private val maxRetries = 3
            
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    super.onReceivedError(view, request, error)
                    Log.e(tag, "WebView error: ${error?.description}")
                    Log.e(tag, "Failed URL: ${request?.url}")
                    Log.e(tag, "Error code: ${error?.errorCode}")
                    
                    // Only show error for main frame
                    if (request?.isForMainFrame == true) {
                        showConnectionStatus("FAILED", "Failed to load URL: ${error?.description}")
                        
                        if (retryCount < maxRetries) {
                            retryCount++
                            // Try next URL with exponential backoff
                            val delayMs = (Math.pow(2.0, retryCount.toDouble()) * 1000).toLong()
                            view?.postDelayed({
                                tryNextUrl()
                            }, delayMs)
                        } else {
                            Log.e(tag, "Max retries ($maxRetries) reached")
                            showConnectionStatus("FAILED", "Failed to connect after $maxRetries attempts")
                            retryCount = 0  // Reset for next attempt
                            currentUrlIndex = 0  // Reset URL index
                        }
                    }
                }
            }
            
            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                super.onReceivedHttpError(view, request, errorResponse)
                Log.e(tag, "HTTP Error: ${errorResponse?.statusCode} for URL: ${request?.url}")
                Log.e(tag, "Error response: ${errorResponse?.reasonPhrase}")
                
                if (request?.isForMainFrame == true) {
                    val errorMessage = "HTTP Error ${errorResponse?.statusCode}: ${errorResponse?.reasonPhrase}"
                    showConnectionStatus("FAILED", errorMessage)
                    
                    if (errorResponse?.statusCode == 502 && retryCount < maxRetries) {
                        retryCount++
                        val delayMs = (Math.pow(2.0, retryCount.toDouble()) * 1000).toLong()
                        view?.postDelayed({
                            tryNextUrl()
                        }, delayMs)
                    }
                }
            }
            
            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                Log.e(tag, "SSL Error: ${error?.primaryError} for URL: ${error?.url}")
                
                val errorMessage = when (error?.primaryError) {
                    SslError.SSL_DATE_INVALID -> "The certificate is not yet valid or has expired"
                    SslError.SSL_INVALID -> "There is a general SSL error"
                    SslError.SSL_NOTYETVALID -> "The certificate is not yet valid"
                    SslError.SSL_EXPIRED -> "The certificate has expired"
                    SslError.SSL_IDMISMATCH -> "Hostname mismatch"
                    SslError.SSL_UNTRUSTED -> "The certificate authority is not trusted"
                    else -> "Unknown SSL error occurred"
                }
                
                // Only proceed for development environment
                if (BuildConfig.DEBUG && error?.url?.startsWith("http://10.0.2.2") == true) {
                    Log.w(tag, "Proceeding despite SSL error in development: $errorMessage")
                    handler?.proceed()
                } else {
                    Log.e(tag, "SSL Error - canceling connection: $errorMessage")
                    handler?.cancel()
                    showConnectionStatus("FAILED", "Security Error: $errorMessage")
                }
            }
            
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                // Inject CSP
                view?.evaluateJavascript(
                    """
                    var meta = document.createElement('meta');
                    meta.httpEquiv = "Content-Security-Policy";
                    meta.content = "$csp";
                    document.head.appendChild(meta);
                    """.trimIndent(),
                    null
                )
                Log.d(tag, "Starting to load page: $url")
                showConnectionStatus("CONNECTING", "Loading $url...")
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(tag, "Page loaded: $url")
                
                // Reset retry count and URL index on successful load
                retryCount = 0
                currentUrlIndex = 0
                
                // Check if this is our debug page
                if (url?.startsWith("data:") == true) {
                    return
                }
                
                // Successfully loaded the actual URL
                showConnectionStatus("CONNECTED", "Successfully loaded $url")
            }
            
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                Log.d(tag, "Attempting to load URL: ${request?.url}")
                return false // Let the WebView handle the URL
            }
        }
        
        // Start with the first URL
        tryNextUrl()
        
        // Set a timeout for the initial page load
        webView.postDelayed({
            if (!isPageLoaded) {
                Log.e(tag, "Page load timeout for current URL")
                tryNextUrl()  // Try next URL on timeout
            }
        }, 10000) // Reduced timeout to 10 seconds for faster fallback
        
        // Register broadcast receivers
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(commandReceiver, IntentFilter().apply {
                addAction("com.displaybeheer.player.UPDATE_URL")
                addAction("com.displaybeheer.player.TAKE_SCREENSHOT")
                addAction("com.displaybeheer.player.UPDATE_APK")
            }, Context.RECEIVER_NOT_EXPORTED)

            registerReceiver(connectionReceiver, IntentFilter().apply {
                addAction("com.displaybeheer.player.CONNECTION_STATE")
            }, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(commandReceiver, IntentFilter().apply {
                addAction("com.displaybeheer.player.UPDATE_URL")
                addAction("com.displaybeheer.player.TAKE_SCREENSHOT")
                addAction("com.displaybeheer.player.UPDATE_APK")
            })

            registerReceiver(connectionReceiver, IntentFilter().apply {
                addAction("com.displaybeheer.player.CONNECTION_STATE")
            })
        }

        // Show initial connecting status
        showConnectionStatus("CONNECTING", "Initializing connection...")
    }
    
    private var isPageLoaded = false
    
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
    
    private fun tryNextUrl() {
        if (currentUrlIndex < serverUrls.size) {
            val nextUrl = serverUrls[currentUrlIndex]
            Log.d(tag, "Trying next server URL: $nextUrl")
            webView.loadUrl(nextUrl)
            currentUrlIndex++
        } else {
            Log.e(tag, "All server URLs failed")
            showConnectionStatus("FAILED", "Could not connect to any server")
            currentUrlIndex = 0  // Reset for next retry
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(commandReceiver)
        unregisterReceiver(connectionReceiver)
    }
} 