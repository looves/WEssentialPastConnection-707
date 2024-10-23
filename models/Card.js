const { Schema, model } = require('mongoose');

const cardSchema = new Schema({
  idol: { type: String, required: true },
  grupo: { type: String, required: true },
  era: { type: String, required: true },
  eshort: { type: String, required: true},
  rarity: { type: String, required: true }, // Agregado
  image: { type: String, required: true },
  event: { type: String, default: false },
  count: { type: Number, default: 0 }, // Para llevar el conteo de apariciones
});

module.exports = model('Card', cardSchema);
