const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const DroppedCard = require('../models/DroppedCard');
const Card = require('../models/Card');
const rarityToEmojis = require('../utils/rarityToEmojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('favorite')
    .setDescription('Selecciona una carta como tu favorita')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Código único de la carta que quieres marcar como favorita')
        .setRequired(true))
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

  async execute(interaction) {
    const code = interaction.options.getString('code');
    const userId = interaction.user.id;

    try {
      // Verifica que la carta pertenece al usuario
      const droppedCard = await DroppedCard.findOne({ uniqueCode: code, userId: userId });

      if (!droppedCard) {
        return interaction.reply({ content: 'No tienes una carta con ese código en tu inventario.', ephemeral: true });
      }

      // Busca la carta completa utilizando cardId
      const card = await Card.findById(droppedCard.cardId);

      if (!card) {
        return interaction.reply({ content: 'No se encontró la carta correspondiente en la base de datos.', ephemeral: true });
      }

      // Actualiza la carta favorita del usuario, asegurándose de obtener el documento actualizado
      const updatedUser = await User.findOneAndUpdate(
        { userId: userId }, 
        { favoriteCard: code }, 
        { new: true, upsert: true } // Devuelve el documento actualizado
      );

      // Verifica si el usuario fue actualizado correctamente
      if (!updatedUser || updatedUser.favoriteCard !== code) {
        return interaction.reply({ content: 'Hubo un problema actualizando tu carta favorita. Intenta de nuevo.', ephemeral: true });
      }

      // Crea y envía el embed
      const embed = new EmbedBuilder()
        .setAuthor({ name: `${interaction.user.username}'s Favorite card`, iconURL: interaction.user.displayAvatarURL()})
        .setImage(card.image)
        .setColor('#60a5fa');

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error al ejecutar el comando favorite:', error);
      await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  },
};
