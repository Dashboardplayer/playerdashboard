const cron = require('node-cron');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');
const Player = require('../models/Player');
const { secureLog } = require('../utils/secureLogger');

dotenv.config();

const isCloudinaryConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const getRetentionDays = () => {
  const value = Number(process.env.CLOUDINARY_SCREENSHOT_RETENTION_DAYS || 7);
  return Number.isFinite(value) && value > 0 ? value : 7;
};

const getScreenshotFolder = () => (
  process.env.CLOUDINARY_SCREENSHOTS_FOLDER || 'playerdashboard/screenshots'
).replace(/^\/+|\/+$/g, '');

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
};

async function cleanupOldCloudinaryScreenshots() {
  if (process.env.CLOUDINARY_SCREENSHOT_CLEANUP === 'false') {
    secureLog.info('Cloudinary screenshot cleanup skipped: disabled by environment');
    return { deletedCount: 0, skipped: true };
  }

  if (!isCloudinaryConfigured()) {
    secureLog.info('Cloudinary screenshot cleanup skipped: Cloudinary is not configured');
    return { deletedCount: 0, skipped: true };
  }

  configureCloudinary();

  const retentionDays = getRetentionDays();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const folder = getScreenshotFolder();
  const prefix = `${folder}/`;
  const publicIdsToDelete = [];
  let nextCursor;

  do {
    const response = await cloudinary.api.resources({
      resource_type: 'image',
      type: 'upload',
      prefix,
      max_results: 100,
      next_cursor: nextCursor
    });

    const oldResources = (response.resources || []).filter((resource) => (
      resource.public_id &&
      resource.created_at &&
      new Date(resource.created_at) < cutoffDate
    ));

    publicIdsToDelete.push(...oldResources.map((resource) => resource.public_id));
    nextCursor = response.next_cursor;
  } while (nextCursor);

  if (publicIdsToDelete.length === 0) {
    secureLog.info('Cloudinary screenshot cleanup completed: no old screenshots found', {
      folder,
      retentionDays
    });
    return { deletedCount: 0, skipped: false };
  }

  for (const ids of chunk(publicIdsToDelete, 100)) {
    await cloudinary.api.delete_resources(ids, {
      resource_type: 'image',
      type: 'upload'
    });
  }

  await Player.updateMany(
    { 'screenshot.public_id': { $in: publicIdsToDelete } },
    {
      $set: {
        'screenshot.image_data': null,
        'screenshot.public_id': null,
        'screenshot.timestamp': null
      }
    }
  );

  secureLog.info('Cloudinary screenshot cleanup completed', {
    folder,
    retentionDays,
    deletedCount: publicIdsToDelete.length
  });

  return { deletedCount: publicIdsToDelete.length, skipped: false };
}

const schedule = process.env.CLOUDINARY_SCREENSHOT_CLEANUP_CRON || '15 3 * * *';

if (process.env.NODE_ENV !== 'test') {
  cron.schedule(schedule, () => {
    cleanupOldCloudinaryScreenshots().catch((error) => {
      secureLog.error('Cloudinary screenshot cleanup failed', {
        message: error.message
      });
    });
  });

  setTimeout(() => {
    cleanupOldCloudinaryScreenshots().catch((error) => {
      secureLog.error('Cloudinary screenshot startup cleanup failed', {
        message: error.message
      });
    });
  }, 60000);
}

module.exports = cleanupOldCloudinaryScreenshots;
