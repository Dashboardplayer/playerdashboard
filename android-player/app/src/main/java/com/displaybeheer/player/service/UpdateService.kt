package com.displaybeheer.player.service

import android.app.DownloadManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.content.FileProvider
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import org.json.JSONObject

class UpdateService : Service() {
    private val coroutineScope = CoroutineScope(Dispatchers.IO + Job())
    private lateinit var usbReceiver: BroadcastReceiver
    private var updateJob: Job? = null
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val updateDir: File by lazy {
        File(getExternalFilesDir(null), "update").apply { mkdirs() }
    }
    
    private val backupDir: File by lazy {
        File(getExternalFilesDir(null), "backup").apply { mkdirs() }
    }
    
    private var downloadId: Long = 0
    private lateinit var downloadManager: DownloadManager
    private lateinit var downloadCompleteReceiver: BroadcastReceiver

    override fun onCreate() {
        super.onCreate()
        // Listen for system update commands
        setupUpdateReceiver()
        setupUsbReceiver()
        downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        setupDownloadCompleteReceiver()
    }
    
    private fun setupUsbReceiver() {
        usbReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                        handleUsbAttached()
                    }
                    UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                        handleUsbDetached()
                    }
                }
            }
        }
        
        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
        }
        registerReceiver(usbReceiver, filter)
    }
    
    private fun handleUsbAttached() {
        // Check if this is an update USB
        if (isUpdateUsb()) {
            // Get the update URL from USB or use a default
            val updateUrl = getUpdateUrlFromUsb() ?: return
            startUpdateProcess(updateUrl)
        }
    }
    
    private fun handleUsbDetached() {
        updateJob?.cancel()
    }
    
    private fun getUpdateUrlFromUsb(): String? {
        val usbPath = getUsbPath() ?: return null
        val updateConfigFile = File(usbPath, "update.config")
        return if (updateConfigFile.exists()) {
            updateConfigFile.readText().trim()
        } else {
            null
        }
    }
    
    private fun isUpdateUsb(): Boolean {
        // Check for rockadb folder and required files
        val usbPath = getUsbPath()
        if (usbPath == null) return false
        
        val rockadbFolder = File(usbPath, "rockadb")
        val requiredFiles = listOf(
            "update.zip",
            "update.sh",
            "rockadb"
        )
        
        return rockadbFolder.exists() && 
               requiredFiles.all { requiredFile -> File(usbPath, requiredFile).exists() }
    }
    
    private fun getUsbPath(): String? {
        // Get the first mounted USB storage path
        val storageDirs = getExternalFilesDirs(null)
        return storageDirs.firstOrNull { dir -> !dir.absolutePath.contains("emulated") }?.parent
    }
    
    private fun setupUpdateReceiver() {
        val filter = IntentFilter("com.displaybeheer.player.SYSTEM_UPDATE")
        registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val updateUrl = intent?.getStringExtra("updateUrl")
                if (updateUrl != null) {
                    startUpdateProcess(updateUrl)
                }
            }
        }, filter)
    }
    
    private fun startUpdateProcess(updateUrl: String) {
        coroutineScope.launch {
            try {
                // 1. Create backup
                createBackup()
                
                // 2. Download and validate update files
                val baseUrl = updateUrl.trimEnd('/')
                val files = listOf(
                    "rockadb/rockadb",
                    "update.zip",
                    "update.sh",
                    "rockadb"
                )
                
                var totalProgress = 0
                val progressStep = 100 / files.size
                
                for (file in files) {
                    val fileUrl = "$baseUrl/$file"
                    val targetFile = File(updateDir, file)
                    
                    // Create parent directories if needed
                    targetFile.parentFile?.mkdirs()
                    
                    // Download file with progress
                    downloadFileWithProgress(fileUrl, targetFile) { progress ->
                        val currentProgress = totalProgress + (progress * progressStep / 100)
                        updateProgress(currentProgress)
                    }
                    
                    // Validate file
                    if (!validateFile(targetFile)) {
                        throw IOException("File validation failed: $file")
                    }
                    
                    totalProgress += progressStep
                }
                
                // 3. Make update script executable
                File(updateDir, "update.sh").setExecutable(true)
                
                // 4. Execute update script with timeout
                val process = ProcessBuilder()
                    .command("sh", "${updateDir.absolutePath}/update.sh")
                    .directory(updateDir)
                    .start()
                
                // Wait for update to complete with timeout
                if (!process.waitFor(30, TimeUnit.MINUTES)) {
                    process.destroyForcibly()
                    throw IOException("Update process timed out")
                }
                
                // 5. Verify update success
                if (process.exitValue() != 0) {
                    throw IOException("Update process failed with exit code: ${process.exitValue()}")
                }
                
                // 6. Clean up backup on success
                cleanupBackup()
                
                // 7. Shutdown device
                val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
                powerManager.reboot(null)
                
            } catch (e: Exception) {
                e.printStackTrace()
                // Attempt rollback on failure
                performRollback()
                // Notify dashboard of update failure
                sendBroadcast(Intent("com.displaybeheer.player.UPDATE_FAILED")
                    .putExtra("error", e.message))
            }
        }
    }
    
    private suspend fun downloadFileWithProgress(url: String, targetFile: File, onProgress: (Int) -> Unit) {
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(url)
                .build()
            
            try {
                httpClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        throw IOException("Failed to download $url: ${response.code}")
                    }
                    
                    val body = response.body ?: throw IOException("Empty response body")
                    val contentLength = body.contentLength()
                    var bytesRead = 0L
                    
                    body.byteStream().use { input ->
                        FileOutputStream(targetFile).use { output ->
                            val buffer = ByteArray(8192)
                            var read: Int
                            
                            while (input.read(buffer).also { read = it } != -1) {
                                output.write(buffer, 0, read)
                                bytesRead += read
                                
                                if (contentLength > 0) {
                                    val progress = ((bytesRead * 100) / contentLength).toInt()
                                    onProgress(progress)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                throw IOException("Failed to download $url: ${e.message}")
            }
        }
    }
    
    private fun validateFile(file: File): Boolean {
        // Add file validation logic here
        // For example, check file size, checksum, etc.
        return file.exists() && file.length() > 0
    }
    
    private fun createBackup() {
        // Create backup of current system files
        // This is a simplified example - you'll need to implement the actual backup logic
        val backupFile = File(backupDir, "system_backup_${System.currentTimeMillis()}.zip")
        // Implement backup creation logic
    }
    
    private fun performRollback() {
        // Restore from backup
        // This is a simplified example - you'll need to implement the actual rollback logic
        val backupFiles = backupDir.listFiles()?.filter { it.name.startsWith("system_backup_") }
        if (!backupFiles.isNullOrEmpty()) {
            val latestBackup = backupFiles.maxByOrNull { it.lastModified() }
            // Implement rollback logic using latestBackup
        }
    }
    
    private fun cleanupBackup() {
        // Clean up backup files after successful update
        backupDir.deleteRecursively()
        backupDir.mkdirs()
    }
    
    private fun updateProgress(progress: Int) {
        val progressData = JSONObject().apply {
            put("type", "updateProgress")
            put("progress", progress)
            put("timestamp", System.currentTimeMillis())
        }
        sendBroadcast(Intent("com.displaybeheer.player.UPDATE_PROGRESS")
            .putExtra("progress", progress))
    }
    
    private fun setupDownloadCompleteReceiver() {
        downloadCompleteReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == DownloadManager.ACTION_DOWNLOAD_COMPLETE) {
                    val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                    if (id == downloadId) {
                        onDownloadComplete()
                    }
                }
            }
        }
        registerReceiver(downloadCompleteReceiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
    }

    private fun startDownload(updateUrl: String) {
        val request = DownloadManager.Request(Uri.parse(updateUrl))
            .setTitle("App Update")
            .setDescription("Downloading new version")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "update.apk")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        downloadId = downloadManager.enqueue(request)
    }

    private fun onDownloadComplete() {
        val query = DownloadManager.Query().setFilterById(downloadId)
        val cursor = downloadManager.query(query)

        if (cursor.moveToFirst()) {
            val columnIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
            if (columnIndex >= 0 && cursor.getInt(columnIndex) == DownloadManager.STATUS_SUCCESSFUL) {
                val downloadedApkFile = File(
                    getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                    "update.apk"
                )

                if (downloadedApkFile.exists()) {
                    installApk(downloadedApkFile)
                }
            }
        }
        cursor.close()
    }

    private fun installApk(apkFile: File) {
        val apkUri = FileProvider.getUriForFile(
            this,
            "${applicationContext.packageName}.fileprovider",
            apkFile
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
        }
        startActivity(intent)
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(usbReceiver)
        updateJob?.cancel()
        coroutineScope.cancel()
        httpClient.dispatcher.executorService.shutdown()
        unregisterReceiver(downloadCompleteReceiver)
    }
} 