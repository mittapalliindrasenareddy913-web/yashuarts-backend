import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customer_name: {
      type: String,
      required: true,
    },
    customer_phone: {
      type: String,
      required: true,
    },
    email_address: {
      type: String,
      required: true,
    },
    complete_address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
    artwork_type: {
      type: String,
      required: true,
    },
    artwork_size: {
      type: String,
      required: true,
    },
    reference_image_url: {
      type: String,
      required: true,
    },
    special_instructions: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
    },
    payment_status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    payment_method: {
      type: String,
      enum: ['UPI', 'Cash', 'Online'],
      default: 'UPI',
    },
    delivery_preference: {
      type: String,
      enum: ['Standard', 'Express', 'Pick Up'],
      default: 'Standard',
    },
    order_status: {
      type: String,
      enum: ['Order Received', 'Under Review', 'Artist Contacted', 'Artwork In Progress', 'Completed', 'Delivered'],
      default: 'Order Received',
    },
    internal_notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model('Order', OrderSchema);
export default Order;
