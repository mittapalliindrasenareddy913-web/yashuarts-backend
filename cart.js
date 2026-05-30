import express from 'express';
import Cart from '../models/Cart.js';
import Artwork from '../models/Artwork.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ─── Helper: format cart item ──────────────────────────────────────────────────
const formatCartItem = (cartEntry) => ({
  _id: cartEntry._id,
  artworkId: cartEntry.artworkId._id || cartEntry.artworkId,
  title: cartEntry.artworkId.title || '',
  image_url: cartEntry.artworkId.image_url || '',
  price: cartEntry.artworkId.price || 0,
  category: cartEntry.artworkId.category || '',
  quantity: cartEntry.quantity,
  subtotal: (cartEntry.artworkId.price || 0) * cartEntry.quantity,
});

// @desc    Get user's cart (populated with artwork details)
// @route   GET /api/cart
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const items = await Cart.find({ userId: req.user._id })
      .populate('artworkId', 'title image_url price category is_visible')
      .sort({ createdAt: -1 });

    const formatted = items.map(formatCartItem);
    const total = formatted.reduce((sum, item) => sum + item.subtotal, 0);
    const count = formatted.reduce((sum, item) => sum + item.quantity, 0);

    res.json({ success: true, items: formatted, total, count });
  } catch (error) {
    console.error('Cart GET error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get cart item count only
// @route   GET /api/cart/count
// @access  Private
router.get('/count', protect, async (req, res) => {
  try {
    const items = await Cart.find({ userId: req.user._id });
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Cart count error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Add artwork to cart (or increment qty if already in cart)
// @route   POST /api/cart/:artworkId
// @access  Private
router.post('/:artworkId', protect, async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.artworkId);
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }

    const existing = await Cart.findOne({
      userId: req.user._id,
      artworkId: req.params.artworkId,
    });

    if (existing) {
      // Increment qty (cap at 10)
      existing.quantity = Math.min(10, existing.quantity + 1);
      await existing.save();
    } else {
      await Cart.create({
        userId: req.user._id,
        artworkId: req.params.artworkId,
        quantity: 1,
      });
    }

    // Return updated count
    const allItems = await Cart.find({ userId: req.user._id });
    const count = allItems.reduce((sum, item) => sum + item.quantity, 0);

    res.json({ success: true, message: 'Artwork added to cart', count });
  } catch (error) {
    console.error('Cart POST error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update quantity of a cart item
// @route   PUT /api/cart/:artworkId
// @access  Private
router.put('/:artworkId', protect, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    const item = await Cart.findOne({
      userId: req.user._id,
      artworkId: req.params.artworkId,
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not in cart' });
    }

    item.quantity = Math.min(10, quantity);
    await item.save();

    const allItems = await Cart.find({ userId: req.user._id });
    const count = allItems.reduce((sum, i) => sum + i.quantity, 0);

    res.json({ success: true, message: 'Quantity updated', count });
  } catch (error) {
    console.error('Cart PUT error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Remove one artwork from cart
// @route   DELETE /api/cart/:artworkId
// @access  Private
router.delete('/clear', protect, async (req, res) => {
  try {
    await Cart.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'Cart cleared', count: 0 });
  } catch (error) {
    console.error('Cart clear error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
router.delete('/:artworkId', protect, async (req, res) => {
  try {
    const result = await Cart.findOneAndDelete({
      userId: req.user._id,
      artworkId: req.params.artworkId,
    });

    if (!result) {
      return res.status(404).json({ message: 'Item not in cart' });
    }

    const allItems = await Cart.find({ userId: req.user._id });
    const count = allItems.reduce((sum, i) => sum + i.quantity, 0);

    res.json({ success: true, message: 'Item removed from cart', count });
  } catch (error) {
    console.error('Cart DELETE error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
