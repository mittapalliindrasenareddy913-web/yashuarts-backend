import express from 'express';
import Review from '../models/Review.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get reviews for an artwork
// @route   GET /api/reviews/:artworkId
// @access  Public (or Private, here Private to align with Supabase RLS)
router.get('/:artworkId', protect, async (req, res) => {
  try {
    const reviews = await Review.find({ artwork_id: req.params.artworkId })
      .populate('user_id', 'full_name avatar_url')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a review for an artwork
// @route   POST /api/reviews/:artworkId
// @access  Private
router.post('/:artworkId', protect, async (req, res) => {
  const { rating, comment } = req.body;

  try {
    const review = new Review({
      artwork_id: req.params.artworkId,
      user_id: req.user._id,
      rating,
      comment: comment || '',
    });

    const createdReview = await review.save();
    
    // Populate user info for immediate frontend state update
    const populatedReview = await Review.findById(createdReview._id).populate(
      'user_id',
      'full_name avatar_url'
    );

    res.status(201).json(populatedReview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
