'use strict';

const express          = require('express');
const { summariseNote } = require('../controllers/aiController');
const { protect }      = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.post('/summarise', summariseNote);

module.exports = router;
