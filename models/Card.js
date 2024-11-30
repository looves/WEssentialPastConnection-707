const { Schema, model } = require('mongoose');

const cardSchema = new Schema({
  idol: { type: String, required: true, index: true },
  grupo: { type: String, required: true, index: true },
  era: { type: String, required: true, index: true },
  eshort: { type: String, required: true, index: true },
  rarity: { type: String, required: true, index: true }, // Agregado
  image: { type: String, required: true, index: true },
  event: { type: String, default: false, index: true },
  count: { type: Number, default: 0 }, // Para llevar el conteo de apariciones
});

module.exports = model('Card', cardSchema);
