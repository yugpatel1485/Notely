'use strict';

/**
 * analyticsController.js  (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes:
 *   GET /api/analytics/dashboard  — summary stats for the authenticated user
 *   POST /api/notes/:id/view      — record a view on a PUBLIC note only
 *
 * Security fix: recordView now verifies the note exists AND is public before
 * incrementing the counter. Previously it accepted any ObjectId, allowing
 * unauthenticated callers to (a) confirm whether private note IDs exist and
 * (b) spam view counts on private notes.
 */

const Note = require('../models/Note');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/notes/:id/view
 * Increments view counter for PUBLIC notes only. No auth required.
 */
async function recordView(req, res, next) {
  try {
    const note = await Note.findById(req.params.id).select('isPublic');

    // Return 404 for both missing notes AND private notes — never confirm
    // whether a private note ID exists to unauthenticated callers.
    if (!note || !note.isPublic) {
      return res.status(404).end();
    }

    await Note.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.viewCount': 1 },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/dashboard
 * Returns aggregate stats for the authenticated user's notes.
 */
async function getDashboardStats(req, res, next) {
  try {
    const userId = req.user._id;

    const [
      totalNotes,
      publicNotes,
      pinnedNotes,
      viewStats,
      tagAgg,
      recentActivity,
    ] = await Promise.all([
      Note.countDocuments({ owner: userId }),
      Note.countDocuments({ owner: userId, isPublic: true }),
      Note.countDocuments({ owner: userId, isPinned: true }),
      Note.aggregate([
        { $match: { owner: userId } },
        { $group: { _id: null, totalViews: { $sum: '$analytics.viewCount' } } },
      ]),
      Note.aggregate([
        { $match: { owner: userId } },
        { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { tag: '$_id', count: 1, _id: 0 } },
      ]),
      Note.find({ owner: userId })
          .sort({ updatedAt: -1 })
          .limit(5)
          .select('title updatedAt isPublic analytics.viewCount'),
    ]);

    const topViewed = await Note.find({ owner: userId, isPublic: true })
      .sort({ 'analytics.viewCount': -1 })
      .limit(5)
      .select('title analytics.viewCount updatedAt');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const createdOverTime = await Note.aggregate([
      { $match: { owner: userId, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          _id:   0,
          month: { $concat: [
            { $toString: '$_id.year' }, '-',
            { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] },
          ]},
          count: 1,
        },
      },
    ]);

    return sendSuccess(res, {
      overview: {
        totalNotes,
        publicNotes,
        pinnedNotes,
        totalViews: viewStats[0]?.totalViews ?? 0,
      },
      topTags:        tagAgg,
      topViewed,
      recentActivity,
      createdOverTime,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordView, getDashboardStats };
