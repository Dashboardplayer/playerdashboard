import User from '../models/User.js';
import { companyAPI, playerAPI, authAPI, userAPI } from '../hooks/apiClient.js';
import Command from '../models/Command.js';
import Schedule from '../models/Schedule.js';
import Log from '../models/Log.js';
import Update from '../models/Update.js';
import { mongoClient } from '../hooks/mongoClient.js';

// A service to provide database operation methods similar to Supabase
// This will make it easier to migrate the existing code

// User operations
export const userService = {
  // Get all users
  async getAll(companyId = null) {
    try {
      // Use userAPI to get users
      const { data, error } = await userAPI.getAll(companyId);
      
      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get a user by ID
  async getById(userId) {
    try {
      const { data, error } = await userAPI.getUserById(userId);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get a user by email
  async getByEmail(email) {
    try {
      const { data, error } = await userAPI.getUserByEmail(email);
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update a user
  async update(userId, updates) {
    try {
      const { data, error } = await userAPI.update(userId, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete a user
  async delete(userId) {
    try {
      const { error } = await userAPI.deleteUser(userId);
      return { error };
    } catch (error) {
      return { error };
    }
  }
};

// Company operations
export const companyService = {
  // Get all companies
  async getAll() {
    return await companyAPI.getAll();
  },

  // Get a company by ID
  async getById(id) {
    try {
      const company = await companyAPI.getById(id);
      return { data: company, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get a company by company_id
  async getByCompanyId(companyId) {
    const { data, error } = await companyAPI.getAll();
    if (error) return { data: null, error };
    const company = data.find(c => c.company_id === companyId);
    return { data: company, error: null };
  },

  // Create a new company
  async create(companyData) {
    try {
      const company = await companyAPI.create(companyData);
      return { data: company, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update a company
  async update(id, updates) {
    try {
      const company = await companyAPI.update(id, updates);
      return { data: company, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete a company
  async delete(id) {
    try {
      await companyAPI.delete(id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }
};

// Player operations
export const playerService = {
  // Get all players
  async getAll() {
    return await playerAPI.getAll();
  },

  // Get players by company_id
  async getByCompanyId(companyId) {
    return await playerAPI.getAll(companyId);
  },

  // Get a player by ID
  async getById(id) {
    try {
      const player = await playerAPI.getById(id);
      return { data: player, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create a new player
  async create(playerData) {
    try {
      const player = await playerAPI.create(playerData);
      return { data: player, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update a player
  async update(id, updates) {
    try {
      const player = await playerAPI.update(id, updates);
      return { data: player, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete a player
  async delete(id) {
    try {
      const result = await playerAPI.delete(id);
      if (result.error) {
        throw new Error(result.error);
      }
      return { error: null };
    } catch (error) {
      console.error('Error in playerService.delete:', error);
      return { error: error.message || 'Failed to delete player' };
    }
  }
};

// Command operations
export const commandService = {
  // Get all commands
  async getAll() {
    try {
      const commands = await Command.find().sort({ createdAt: -1 });
      return { data: commands, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get commands by player_id
  async getByPlayerId(playerId) {
    try {
      const commands = await Command.find({ player_id: playerId }).sort({ createdAt: -1 });
      return { data: commands, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create a new command
  async create(commandData) {
    try {
      const command = new Command(commandData);
      await command.save();
      return { data: command, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update a command
  async update(id, updates) {
    try {
      const command = await Command.findByIdAndUpdate(
        id,
        updates,
        { new: true }
      );
      return { data: command, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Schedule operations
export const scheduleService = {
  // Get all schedules
  async getAll() {
    try {
      const schedules = await Schedule.find().sort({ start_time: 1 });
      return { data: schedules, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get schedules by player_id
  async getByPlayerId(playerId) {
    try {
      const schedules = await Schedule.find({ player_id: playerId }).sort({ start_time: 1 });
      return { data: schedules, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create a new schedule
  async create(scheduleData) {
    try {
      const schedule = new Schedule(scheduleData);
      await schedule.save();
      return { data: schedule, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update a schedule
  async update(id, updates) {
    try {
      const schedule = await Schedule.findByIdAndUpdate(
        id,
        updates,
        { new: true }
      );
      return { data: schedule, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete a schedule
  async delete(id) {
    try {
      await Schedule.findByIdAndDelete(id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  }
};

// Log operations
export const logService = {
  // Create a new log
  async create(logData) {
    try {
      const log = new Log(logData);
      await log.save();
      return { data: log, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get logs by user_id
  async getByUserId(userId) {
    try {
      const logs = await Log.find({ user_id: userId }).sort({ createdAt: -1 });
      return { data: logs, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Update operations
export const updateService = {
  // Get all updates
  async getAll() {
    try {
      const updates = await Update.find().sort({ createdAt: -1 });
      return { data: updates, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get updates by player_id
  async getByPlayerId(playerId) {
    try {
      const updates = await Update.find({ player_id: playerId }).sort({ createdAt: -1 });
      return { data: updates, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Create a new update
  async create(updateData) {
    try {
      const update = new Update(updateData);
      await update.save();
      return { data: update, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update an update record
  async update(id, updates) {
    try {
      const update = await Update.findByIdAndUpdate(
        id,
        updates,
        { new: true }
      );
      return { data: update, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};