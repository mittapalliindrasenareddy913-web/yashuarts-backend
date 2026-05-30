import mongoose from 'mongoose';

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    artworkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artwork',
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one entry per user + artwork
CartSchema.index({ userId: 1, artworkId: 1 }, { unique: true });

const Cart = mongoose.model('Cart', CartSchema);
export default Cart;
