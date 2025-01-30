const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  cards: [{
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
    count: { type: Number, required: true, default: 0 }
  }],
  packs: {
    type: Map,
    of: Number, // Almacena la cantidad de cada tipo de pack, por ejemplo: { 'WPACK': 3, 'WPACKS': 1 }
    default: {},
    required: true,
  },
});

module.exports = mongoose.model('Inventory', inventorySchema);
