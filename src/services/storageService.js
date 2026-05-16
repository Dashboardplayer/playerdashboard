const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const { secureLog } = require('../utils/secureLogger');

// Storage adapter interface
// To switch to cloud storage, implement these methods and replace the export
class StorageAdapter {
  /**
   * Upload a file and return the public URL
   * @param {File} file - The file to upload
   * @param {string} folder - Optional folder path
   * @returns {Promise<{url: string, filename: string}>}
   */
  async upload(file, folder = 'uploads') {
    throw new Error('upload() must be implemented');
  }

  /**
   * Get public URL for a file
   * @param {string} filename - The filename
   * @returns {Promise<string>}
   */
  async getUrl(filename) {
    throw new Error('getUrl() must be implemented');
  }

  /**
   * Delete a file
   * @param {string} filename - The filename
   * @returns {Promise<void>}
   */
  async delete(filename) {
    throw new Error('delete() must be implemented');
  }
}

// Local storage implementation
class LocalStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads');
    // Use BASE_URL from environment, or fall back to localhost for development
    // In production, this should be set to the actual server IP/domain
    this.baseUrl = process.env.BASE_URL || process.env.PUBLIC_URL || 'http://localhost:5001';
    this.ensureUploadDir();
  }

  ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      secureLog.info('Created upload directory:', this.uploadDir);
    }
  }

  async upload(file, folder = 'uploads') {
    return new Promise((resolve, reject) => {
      try {
        // Generate unique filename
        const ext = path.extname(file.originalname || file.name);
        const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
        const filePath = path.join(this.uploadDir, filename);

        // Write file to disk
        const writeStream = fs.createWriteStream(filePath);
        
        writeStream.on('finish', () => {
          const url = `${this.baseUrl}/uploads/${filename}`;
          secureLog.info('File uploaded successfully:', { filename, url });
          resolve({ url, filename });
        });

        writeStream.on('error', (error) => {
          secureLog.error('Error writing file:', error);
          reject(error);
        });

        // Handle both Buffer and Stream
        if (file.buffer) {
          writeStream.write(file.buffer);
          writeStream.end();
        } else if (file.stream) {
          file.stream.pipe(writeStream);
        } else {
          reject(new Error('Invalid file format'));
        }
      } catch (error) {
        secureLog.error('Error uploading file:', error);
        reject(error);
      }
    });
  }

  async getUrl(filename) {
    return `${this.baseUrl}/uploads/${filename}`;
  }

  async delete(filename) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.uploadDir, filename);
      
      fs.unlink(filePath, (error) => {
        if (error) {
          secureLog.error('Error deleting file:', error);
          reject(error);
        } else {
          secureLog.info('File deleted successfully:', filename);
          resolve();
        }
      });
    });
  }
}

class CloudinaryStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }

  async upload(file, folder = 'playerdashboard/uploads') {
    const dataUri = this.toDataUri(file);
    const originalName = file.originalname || file.name || 'upload';
    const publicId = `${crypto.randomBytes(16).toString('hex')}-${path.parse(originalName).name}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: publicId,
      resource_type: 'auto',
      overwrite: false
    });

    secureLog.info('File uploaded to Cloudinary', {
      publicId: result.public_id,
      resourceType: result.resource_type
    });

    return {
      url: result.secure_url,
      filename: result.public_id,
      publicId: result.public_id,
      resourceType: result.resource_type
    };
  }

  async uploadBase64(imageData, folder = 'playerdashboard/screenshots') {
    const uploadData = imageData.startsWith('data:')
      ? imageData
      : `data:image/jpeg;base64,${imageData}`;

    const result = await cloudinary.uploader.upload(uploadData, {
      folder,
      resource_type: 'image',
      overwrite: false
    });

    secureLog.info('Screenshot uploaded to Cloudinary', { publicId: result.public_id });

    return {
      url: result.secure_url,
      filename: result.public_id,
      publicId: result.public_id,
      resourceType: result.resource_type
    };
  }

  async getUrl(filename) {
    return cloudinary.url(filename, { secure: true });
  }

  async delete(filename) {
    await cloudinary.uploader.destroy(filename, { resource_type: 'image' });
  }

  toDataUri(file) {
    if (!file?.buffer) {
      throw new Error('Cloudinary upload requires an in-memory file buffer');
    }

    const mimetype = file.mimetype || 'application/octet-stream';
    return `data:${mimetype};base64,${file.buffer.toString('base64')}`;
  }
}

const isCloudinaryConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const storageAdapter = isCloudinaryConfigured()
  ? new CloudinaryStorageAdapter()
  : new LocalStorageAdapter();

secureLog.info(`Storage adapter initialized: ${isCloudinaryConfigured() ? 'cloudinary' : 'local'}`);

module.exports = {
  storageAdapter,
  StorageAdapter,
  LocalStorageAdapter,
  CloudinaryStorageAdapter,
  isCloudinaryConfigured
};
