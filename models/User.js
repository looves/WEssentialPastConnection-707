const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
  userId: String,
  cardCount: Number,
  coins: { type: Number, default: 0 },
  favoriteCard: String,
  searchText: String,
  currentStreak: Number,
  lastDaily: { type: Date, default: null },
  lastDrop: { type: Date, default: null },
  lastWork: { type: Date, default: null },
  lastUsedDate: { type: Date, default: null }, 
  isBanned: { type: Boolean, default: false },
  warnings: { type: Number, default: 0, },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }]
});

module.exports = mongoose.model('User', userSchema);
