const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Company = require('../../src/models/Company');
const { auth, authorize } = require('../../src/middleware/auth');
const { broadcastToClients } = require('../helpers/websocketHelper');

function broadcastCompanyEvent(type, payload) {
  broadcastToClients(JSON.stringify({ type, payload }));
}

// Get companies visible to the logged-in user
router.get('/', auth, authorize(['superadmin', 'bedrijfsadmin', 'user']), async (req, res) => {
  try {
    const userData = req.user;

    if (userData.role !== 'superadmin') {
      if (!userData.company_id) {
        return res.json([{ company_name: 'Unknown Company' }]);
      }

      const company = await Company.findByAnyId(userData.company_id);
      if (!company) {
        return res.json([{ company_name: 'Unknown Company' }]);
      }

      return res.json([company]);
    }

    const companies = await Company.find().sort({ company_name: 1 });
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get company by Mongo _id or company_id
router.get('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findByAnyId(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create company
router.post('/', auth, authorize(['superadmin']), async (req, res) => {
  try {
    const company = new Company({
      ...req.body,
      company_id: req.body.company_id || new mongoose.Types.ObjectId().toString()
    });

    await company.save();
    broadcastCompanyEvent('company_created', company);
    res.status(201).json(company);
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update company
router.put('/:id', auth, authorize(['superadmin']), async (req, res) => {
  try {
    const company = await Company.findByAnyId(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    Object.assign(company, req.body);
    await company.save();

    broadcastCompanyEvent('company_updated', company);
    res.json(company);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete company
router.delete('/:id', auth, authorize(['superadmin']), async (req, res) => {
  try {
    const company = await Company.findByAnyId(req.params.id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await company.deleteOne();
    broadcastCompanyEvent('company_deleted', { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
