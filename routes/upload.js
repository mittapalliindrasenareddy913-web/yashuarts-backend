import express from 'express';
import multer from 'multer';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Memory storage keeps file buffers in RAM, avoiding disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// @desc    Upload an image to Cloudinary
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a file' });
  }

  try {
    const folder = req.body.folder || 'yashuarts';
    const result = await uploadToCloudinary(req.file.buffer, folder);
    
    res.json({
      publicUrl: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    res.status(500).json({ message: 'Failed to upload image to Cloudinary' });
  }
});

export default router;
