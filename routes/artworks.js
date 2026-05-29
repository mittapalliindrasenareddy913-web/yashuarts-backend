import express from 'express';
import Artwork from '../models/Artwork.js';
import Like from '../models/Like.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get all artworks
// @route   GET /api/artworks
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const artworks = await Artwork.find({}).sort({ createdAt: -1 });
    res.json(artworks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get logged in user's liked artwork IDs
// @route   GET /api/artworks/likes
// @access  Private
router.get('/likes', protect, async (req, res) => {
  try {
    const likes = await Like.find({ user_id: req.user._id }).select('artwork_id');
    const likedIds = likes.map((l) => l.artwork_id.toString());
    res.json(likedIds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get single artwork by ID (and increment view count)
// @route   GET /api/artworks/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id);

    if (artwork) {
      // Increment views count
      artwork.views_count = (artwork.views_count || 0) + 1;
      await artwork.save();

      res.json(artwork);
    } else {
      res.status(404).json({ message: 'Artwork not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create an artwork
// @route   POST /api/artworks
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  const { title, description, category, price, image_url, is_featured } = req.body;

  try {
    const artwork = new Artwork({
      title,
      description,
      category,
      price,
      image_url,
      is_featured: is_featured || false,
    });

    const createdArtwork = await artwork.save();
    res.status(201).json(createdArtwork);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update an artwork
// @route   PUT /api/artworks/:id
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
  const { title, description, category, price, image_url, is_featured } = req.body;

  try {
    const artwork = await Artwork.findById(req.params.id);

    if (artwork) {
      artwork.title = title || artwork.title;
      artwork.description = description !== undefined ? description : artwork.description;
      artwork.category = category || artwork.category;
      artwork.price = price !== undefined ? price : artwork.price;
      artwork.image_url = image_url || artwork.image_url;
      artwork.is_featured = is_featured !== undefined ? is_featured : artwork.is_featured;

      const updatedArtwork = await artwork.save();
      res.json(updatedArtwork);
    } else {
      res.status(404).json({ message: 'Artwork not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete an artwork
// @route   DELETE /api/artworks/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id);

    if (artwork) {
      await Artwork.deleteOne({ _id: req.params.id });
      // Clean up related likes
      await Like.deleteMany({ artwork_id: req.params.id });
      res.json({ message: 'Artwork removed' });
    } else {
      res.status(404).json({ message: 'Artwork not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Like an artwork
// @route   POST /api/artworks/:id/like
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id);
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }

    const alreadyLiked = await Like.findOne({
      user_id: req.user._id,
      artwork_id: req.params.id,
    });

    if (alreadyLiked) {
      return res.status(400).json({ message: 'Artwork already liked' });
    }

    await Like.create({
      user_id: req.user._id,
      artwork_id: req.params.id,
    });

    artwork.likes_count = (artwork.likes_count || 0) + 1;
    await artwork.save();

    res.json({ message: 'Artwork liked', likes_count: artwork.likes_count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Unlike an artwork
// @route   DELETE /api/artworks/:id/like
// @access  Private
router.delete('/:id/like', protect, async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id);
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }

    const like = await Like.findOne({
      user_id: req.user._id,
      artwork_id: req.params.id,
    });

    if (!like) {
      return res.status(400).json({ message: 'Artwork not liked yet' });
    }

    await Like.deleteOne({ _id: like._id });

    artwork.likes_count = Math.max(0, (artwork.likes_count || 0) - 1);
    await artwork.save();

    res.json({ message: 'Artwork unliked', likes_count: artwork.likes_count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
