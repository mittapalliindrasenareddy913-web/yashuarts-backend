import express from 'express';
import Pricing from '../models/Pricing.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ─── GET /api/pricing ──────────────────────────────────────────────────────────
// @desc    Get all active pricing options
// @access  Public
router.get('/', async (req, res) => {
  try {
    const pricing = await Pricing.find({ isActive: true }).sort({ order: 1 });
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET /api/pricing/all ──────────────────────────────────────────────────────
// @desc    Get ALL pricing options (including inactive)
// @access  Private/Admin
router.get('/all', protect, admin, async (req, res) => {
  try {
    const pricing = await Pricing.find({}).sort({ category: 1, order: 1 });
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/pricing ─────────────────────────────────────────────────────────
// @desc    Create a new pricing option
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  const { category, name, description, price, isActive, order } = req.body;

  try {
    const pricingItem = new Pricing({
      category,
      name,
      description,
      price,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
    });

    const createdPricing = await pricingItem.save();
    res.status(201).json(createdPricing);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── PUT /api/pricing/:id ──────────────────────────────────────────────────────
// @desc    Update a pricing option
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
  const { category, name, description, price, isActive, order } = req.body;

  try {
    const pricingItem = await Pricing.findById(req.params.id);

    if (pricingItem) {
      pricingItem.category = category || pricingItem.category;
      pricingItem.name = name || pricingItem.name;
      pricingItem.description = description || pricingItem.description;
      if (price !== undefined) pricingItem.price = price;
      if (isActive !== undefined) pricingItem.isActive = isActive;
      if (order !== undefined) pricingItem.order = order;

      const updatedPricing = await pricingItem.save();
      res.json(updatedPricing);
    } else {
      res.status(404).json({ message: 'Pricing option not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── DELETE /api/pricing/:id ───────────────────────────────────────────────────
// @desc    Delete a pricing option
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const pricingItem = await Pricing.findById(req.params.id);

    if (pricingItem) {
      await pricingItem.deleteOne();
      res.json({ message: 'Pricing option removed' });
    } else {
      res.status(404).json({ message: 'Pricing option not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/pricing/reset ───────────────────────────────────────────────────
// @desc    Reset defaults
// @access  Private/Admin
router.post('/reset', protect, admin, async (req, res) => {
  try {
    // Delete all existing pricing
    await Pricing.deleteMany({});

    // Default Seed Data
    const defaultPricing = [
      { category: 'style', name: 'Pencil Sketch', description: 'Detailed grayscale drawing capturing deep shade gradients.', price: 800, order: 1 },
      { category: 'style', name: 'Color Portrait', description: 'Vivid hand-colored drawing using professional art pencil mediums.', price: 1500, order: 2 },
      { category: 'style', name: 'Couple Portrait', description: 'Elegant composition detailing two subjects side-by-side.', price: 2500, order: 3 },
      { category: 'dimension', name: 'A4 Portrait (Standard)', description: '8.3 x 11.7 in - Perfect for bookshelves and frames.', price: 0, order: 1 },
      { category: 'dimension', name: 'A3 Portrait (Large)', description: '11.7 x 16.5 in - Eye-catching size for bedroom or living walls.', price: 500, order: 2 },
      { category: 'dimension', name: 'A2 Portrait (Exhibition)', description: '16.5 x 23.4 in - Premium gallery display size detailing fine textures.', price: 1200, order: 3 },
      { category: 'delivery', name: 'Standard', description: '5-7 business days delivery (Free)', price: 0, order: 1 },
      { category: 'delivery', name: 'Express', description: '2-3 business days express delivery (+₹300)', price: 300, order: 2 },
      { category: 'delivery', name: 'Pick Up', description: 'Pick up locally from YashuArts studio (Free)', price: 0, order: 3 },
    ];

    const created = await Pricing.insertMany(defaultPricing);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
