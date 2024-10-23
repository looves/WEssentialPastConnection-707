const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
  userId: String,
  cardCount: Number,
  coins: Number,
  favoriteCard: String,
  searchText: String,
  currentStreak: Number,
  lastDaily: { type: Date },
  lastDrop: { type: Date, default: null },
  lastWork: { type: Date, default: null },
  lastUsedDate: { type: Date, default: null }, // Almacenar la última fecha de uso
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }]
});

module.exports = mongoose.model('User', userSchema);
