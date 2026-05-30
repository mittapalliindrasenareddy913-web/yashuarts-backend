import mongoose from 'mongoose';

const pricingSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ['style', 'dimension', 'delivery'],
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Pricing = mongoose.model('Pricing', pricingSchema);

export default Pricing;
