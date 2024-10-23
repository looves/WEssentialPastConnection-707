const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Muestra el perfil del usuario.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('El usuario cuyo perfil deseas ver.')
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;

    try {
      // Encuentra al usuario
      let user = await User.findOne({ userId: userId });

      if (!user) {
        // Si no existe, crear un nuevo documento de usuario
        user = new User({
          userId: userId,
          cardCount: 0,
          coins: 0,
          favoriteCard: null,
          searchText: '',
          currentStreak: 0,
          lastUsedDate: new Date(0) // Inicializar con una fecha antigua
        });
      }

      // Calcula la racha diaria
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (user.lastUsedDate && user.lastUsedDate.getTime() === today.getTime()) {
        // Si ya se ha usado hoy, no hacer nada
      } else if (user.lastUsedDate && (today.getTime() - user.lastUsedDate.getTime() === 86400000)) {
        // Si el uso es consecutivo (hace un día), incrementar la racha
        user.currentStreak += 1;
      } else {
        // Si no es consecutivo, reiniciar la racha
        user.currentStreak = 1;
      }

      // Actualiza la fecha de la última vez que el usuario usó el bot
      user.lastUsedDate = today;

      // Busca la carta favorita del usuario
      let favoriteCard = null;
      let favoriteCardName = 'Ninguna'; // Valor predeterminado si no hay carta favorita
      if (user.favoriteCard) {
        const droppedCard = await DroppedCard.findOne({ uniqueCode: user.favoriteCard });
        if (droppedCard) {
          const card = await Card.findById(droppedCard.cardId);
          favoriteCard = card ? card.image : null;
          favoriteCardName = card ? card.idol : 'Ninguna'; // Si existe, muestra el nombre de la carta
        }
      }

      // Obtiene la cantidad total de cartas del usuario
      user.cardCount = await DroppedCard.countDocuments({ userId: userId });

      // Guarda el usuario actualizado
      await user.save();

      // Crea el embed para mostrar el perfil del usuario
      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setAuthor({ name: `Profile de ${targetUser.username}`, iconURL: targetUser.displayAvatarURL()})
        .addFields(
          {
            name: 'Looking for:',
            value: user.searchText && user.searchText.trim() !== '' 
              ? `<:dot:1291582825232994305>${user.searchText}` 
              : `<:dot:1291582825232994305>You are not currently searching for any cards.`,
            inline: false
          },
          { name: 'Amount of cards:', value: `<:dot:1291582825232994305>**${user.cardCount}** cards`, inline: true },
          { name: 'Daily streak:', value: `<:dot:1291582825232994305>**${user.currentStreak}** days.`, inline: true }, // Mostrar la racha diaria
          { name: 'Favorite card:', value: '\n', inline: false } // Agregado para mostrar la carta favorita
        );

      // Solo establece la imagen si existe una carta favorita
      if (favoriteCard) {
        embed.setImage(favoriteCard);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error al ejecutar el comando profile:', error);
      await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  },
};
