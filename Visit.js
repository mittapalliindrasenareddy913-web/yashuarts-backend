import mongoose from 'mongoose';

const VisitSchema = new mongoose.Schema(
  {
    session_id: {
      type: String,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ip_address: {
      type: String,
      default: '',
    },
    device_info: {
      type: String,
      default: '',
    },
    page_url: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      enum: ['pageview', 'session_start', 'session_end'],
      default: 'pageview',
    },
    duration: {
      type: Number, // duration in seconds
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Visit = mongoose.model('Visit', VisitSchema);
export default Visit;
