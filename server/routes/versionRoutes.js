'use strict';

const express = require('express');
const {
  listVersions, createSnapshot, getVersion,
  restoreVersion, deleteVersion,
} = require('../controllers/versionController');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(protect);

router.get  ('/',                  listVersions);
router.post ('/',                  createSnapshot);
router.get  ('/:verId',            getVersion);
router.post ('/:verId/restore',    restoreVersion);
router.delete('/:verId',           deleteVersion);

module.exports = router;
