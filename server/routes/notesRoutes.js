'use strict';

const express           = require('express');
const {
  getNotes, getNoteById, createNote, updateNote, deleteNote,
  manageShareToken, getNoteByShareToken, getPublicNotes,
}                       = require('../controllers/notesController');
const { protect }       = require('../middleware/auth');
const {
  createNoteRules, updateNoteRules, validate,
}                       = require('../middleware/validate');

const router = express.Router();

// ── Public routes (no auth needed) ───────────────────────────────────────────
router.get('/public',           getPublicNotes);
router.get('/shared/:token',    getNoteByShareToken);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);   // All routes below require a valid JWT

router.get  ('/',          getNotes);
router.post ('/',          createNoteRules, validate, createNote);
router.get  ('/:id',       getNoteById);
router.put  ('/:id',       updateNoteRules, validate, updateNote);
router.delete('/:id',      deleteNote);
router.post ('/:id/share', manageShareToken);

module.exports = router;
