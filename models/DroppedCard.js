const mongoose = require('mongoose');

const droppedCardSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // ID del usuario que obtuvo la carta
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true }, // Referencia a la carta obtenida
  idol: { type: String, required: true },
  grupo: { type: String, required: true },
  era: { type: String, required: true },
  eshort: { type: String, required: true },
  rarity: { type: String, required: true },
  uniqueCode: { type: String, required: true },
  copyNumber: { type: Number, required: true },
  command: { type: String, required: true }, // Comando en el que se dropeó la carta
});

module.exports = mongoose.model('DroppedCard', droppedCardSchema);
