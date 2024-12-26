const { Schema, model } = require('mongoose');

const cardSchema = new Schema({
  idol: { type: String, required: true, index: true },
  grupo: { type: String, required: true, index: true },
  era: { type: String, required: true, index: true },
  eshort: { type: String, required: true, index: true },
  rarity: { type: String, required: true, index: true },
  image: { type: String, required: true, index: true },
  event: { type: String, required: true, index: true },
  count: { type: Number, default: 0 }, 
});

module.exports = model('Card', cardSchema);
