'use strict';

const express = require('express');
const { exportNote } = require('../controllers/exportController');
const { protect }    = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(protect);
router.get('/', exportNote);   // ?format=pdf | ?format=docx

module.exports = router;
