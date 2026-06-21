const express = require('express');
const router  = express.Router();
const {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  generateShareLink,
  getNoteBySlug,
  shareWithUser,
} = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

// Public — view a shared note by slug (no auth required)
router.get('/shared/:slug', getNoteBySlug);

// All routes below require authentication
router.use(protect);

router.route('/')
  .get(getNotes)
  .post(createNote);

router.route('/:id')
  .get(getNoteById)
  .put(updateNote)
  .delete(deleteNote);

router.post('/:id/share',       generateShareLink);
router.post('/:id/share-with',  shareWithUser);

module.exports = router;
