const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  items: [
    {
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', // Looks for mongoose.model('Product')
        required: true
      },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true } 
    }
  ],

  totalAmount: Number,
  orderDate: { type: Date, default: Date.now },
  status: { type: String, default: 'Paid' }
});

module.exports = mongoose.model('Booking', bookingSchema);