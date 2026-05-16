const mongoose = require('mongoose');
const { secureLog } = require('../../src/utils/secureLogger');

async function createModelIndexes(model, modelName) {
  try {
    await model.createIndexes();
  } catch (error) {
    if (
      error?.code === 85 ||
      error?.code === 86 ||
      error?.codeName === 'IndexOptionsConflict' ||
      error?.codeName === 'IndexKeySpecsConflict'
    ) {
      const indexName = error.message?.match(/name: "([^"]+)"/)?.[1];
      secureLog.warn(`Index conflict for ${modelName}; rebuilding ${indexName || 'conflicting index'}`);

      if (indexName) {
        try {
          await model.collection.dropIndex(indexName);
        } catch (dropError) {
          if (dropError?.codeName !== 'IndexNotFound') {
            throw dropError;
          }
        }
      } else {
        await model.syncIndexes();
        return;
      }

      await model.createIndexes();
      return;
    }

    throw error;
  }
}

function connectDatabase() {
  return mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 200,
    minPoolSize: 20,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 5000
  })
    .then(() => {
      secureLog.info('MongoDB connected successfully');
      const models = [
        ['Player', require('../../src/models/Player')],
        ['Command', require('../../src/models/Command')],
        ['Health', require('../../src/models/Health')],
        ['Log', require('../../src/models/Log')],
        ['Schedule', require('../../src/models/Schedule')],
        ['Group', require('../../src/models/Group')],
        ['User', require('../../src/models/User')],
        ['RefreshToken', require('../../src/models/RefreshToken')],
        ['Company', require('../../src/models/Company')]
      ];

      return Promise.all(models.map(([name, model]) => createModelIndexes(model, name)));
    })
    .then(() => {
      secureLog.info('Database indexes created successfully');
    })
    .catch((err) => {
      secureLog.error('MongoDB connection error:', err);
      process.exit(1);
    });
}

module.exports = { connectDatabase };
