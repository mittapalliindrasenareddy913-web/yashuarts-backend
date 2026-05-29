import mongoose from 'mongoose';

const ArtworkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
      enum: ['Pencil Sketch', 'Color Portrait', 'Couple Sketch', 'Custom Drawing'],
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    image_url: {
      type: String,
      required: true,
    },
    is_featured: {
      type: Boolean,
      default: false,
    },
    likes_count: {
      type: Number,
      default: 0,
    },
    views_count: {
      type: Number,
      default: 0,
    },
    gallery_images: {
      type: [String],
      default: [],
    },
    rating_avg: {
      type: Number,
      default: 4.8,
    },
  },
  {
    timestamps: true,
  }
);

const Artwork = mongoose.model('Artwork', ArtworkSchema);
export default Artwork;
