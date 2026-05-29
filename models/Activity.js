import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: true,
      enum: ['Opened App', 'Viewed Artwork', 'Registered', 'Placed Order', 'Submitted Review', 'Liked Artwork', 'Opened Order Form'],
    },
    details: {
      type: String,
      required: true,
    },
    artwork_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artwork',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const Activity = mongoose.model('Activity', ActivitySchema);
export default Activity;
