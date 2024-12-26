const mongoose = require('mongoose');

const droppedCardSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // ID del usuario que obtuvo la carta
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true, index: true }, // Referencia a la carta obtenida
  idol: { type: String, required: true, index: true },
  grupo: { type: String, required: true, index: true },
  era: { type: String, required: true, index: true },
  eshort: { type: String, required: true, index: true },
  rarity: { type: String, required: true, index: true },
  event: { type: String, required: false, index: true },
  uniqueCode: { type: String, required: true, index: true },
  copyNumber: { type: Number, required: true, index: true },
  command: { type: String, required: true },
});

module.exports = mongoose.model('DroppedCard', droppedCardSchema);
