'use strict';

const express = require('express');
const { getDashboardStats, recordView } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public — record a view (no auth needed, note ID in URL)
router.post('/notes/:id/view', recordView);

// Protected — dashboard stats
router.get('/dashboard', protect, getDashboardStats);

module.exports = router;
