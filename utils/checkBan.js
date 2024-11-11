// utils/checkBan.js

const User = require('../models/User');

async function checkBan(userId) {
  const user = await User.findOne({ userId });
  return user && user.isBanned;
}

module.exports = checkBan;
