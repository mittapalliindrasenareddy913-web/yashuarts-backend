import mongoose from 'mongoose';

const LikeSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    artwork_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artwork',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// User can only like a specific artwork once
LikeSchema.index({ user_id: 1, artwork_id: 1 }, { unique: true });

const Like = mongoose.model('Like', LikeSchema);
export default Like;
