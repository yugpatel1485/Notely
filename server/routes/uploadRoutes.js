'use strict';

const express  = require('express');
const { uploadAttachment, deleteAttachment } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });  // inherits :id from parent

router.use(protect);

router.post  ('/',        uploadAttachment);
router.delete('/:attId',  deleteAttachment);

module.exports = router;
