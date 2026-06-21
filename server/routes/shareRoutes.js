'use strict';

const express  = require('express');
const { shareWithUser, revokeUserAccess, getCollaborators } = require('../controllers/shareController');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });  // inherits :id from parent

router.use(protect);

router.get   ('/',           getCollaborators);
router.post  ('/',           shareWithUser);
router.delete('/:userId',    revokeUserAccess);

module.exports = router;
