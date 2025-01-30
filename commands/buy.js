const { SlashCommandBuilder } = require('discord.js');
const packs = require('../utils/UtilsPacks');
const User = require('../models/User');
const Inventory = require('../models/Inventory'); // Import Inventory model

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Compra un pack de la tienda.')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('El ID del pack que deseas comprar.')
        .setRequired(true)
        .addChoices(
          { name: 'Normal Pack', value: 'NPACK' },
          { name: 'Rare Pack', value: 'RPACK' },
          { name: 'Ultra Pack', value: 'UPACK' },
          { name: 'Epic Pack', value: 'EPACK' },
    )),
  async execute(interaction) {
    const itemId = interaction.options.getString('id');
    const pack = packs.find((p) => p.id === itemId);

    if (!pack) {
      return interaction.reply({
        content: 'No se encontró un pack con ese ID. Por favor, verifica la tienda.',
        ephemeral: true,
      });
    }

    const userId = interaction.user.id;
    const user = await User.findOne({ userId });

    if (!user) {
      return interaction.reply({
        content: 'No se encontró tu cuenta. Por favor, regístrate primero.',
        ephemeral: true,
      });
    }

    if (user.coins < pack.price) {
      return interaction.reply({
        content: `No tienes suficientes monedas para comprar este pack. Necesitas ${pack.price} monedas y solo tienes ${user.coins} .`,
        ephemeral: true,
      });
    }

    user.coins -= pack.price; // Deduct the pack price from user's coins
    await user.save(); // Save updated user data to the database

    // Actualiza el inventario con el pack comprado
    const userInventory = await Inventory.findOne({ userId });
    if (!userInventory) {
      // Si no hay inventario, crea uno nuevo
      const newInventory = new Inventory({
        userId,
        packs: {
          [pack.id]: 1, // Inicializa el pack con cantidad 1
        },
      });
      await newInventory.save();
    } else {
      // Si el inventario existe, agrega o actualiza el pack
      userInventory.packs.set(pack.id, (userInventory.packs.get(pack.id) || 0) + 1); // Aumenta la cantidad del pack
      await userInventory.save();
    }

    return interaction.reply({
      content: `Has adquirido un \`${pack.id}\` a cambio de **${pack.price}** bebegoms.\n-# ¡Buena suerte con tus packs!`,
    });
  },
};
