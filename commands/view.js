const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Card = require('../models/Card');
const rarityToEmojis = require('../utils/rarityToEmojis');
const DroppedCard = require('../models/DroppedCard'); 
const getImageExtension = require('../utils/getImageExtension');

// Función para generar el código de la imagen basado en las iniciales
function cardCodeImg(idol, grupo, era, rarity) {
  return `${idol[0].toUpperCase()}${grupo[0].toUpperCase()}${era[0].toUpperCase()}${rarity}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription('Muestra la información de una carta usando su código único')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Código único de la carta')
        .setRequired(true)),

  async execute(interaction) {
    const uniqueCode = interaction.options.getString('code');


    try {
      // Buscar la carta usando el código
      const droppedCard = await DroppedCard.findOne({ uniqueCode}).populate('cardId');

      if (!droppedCard) {
        return interaction.reply({ content: 'No tienes una carta con ese código en tu inventario.', ephemeral: true });
      }

      const card = droppedCard.cardId;

      const cardCode = cardCodeImg(card.idol, card.grupo, card.era, card.rarity); 

      if (!card) {
        return interaction.reply({ content: 'No se encontró la carta.', ephemeral: true });
      }

      // Obtener el usuario propietario de la carta
      const owner = await interaction.client.users.fetch(droppedCard.userId);
      
        const imgUrl = card.image;
        const extension = getImageExtension(imgUrl);
        const fileCard = `${cardCode}${extension}`; 

      // Crea y envía el embed
      const embed = new EmbedBuilder()
      .setColor('#60a5fa')
      .setFooter({ text: `Looking at ${owner.username}'s card`, iconURL: owner.displayAvatarURL() })      .setTitle(`Card details: `)
      .setDescription(`\`${card.idol}\` de **${card.grupo}** ${card.eshort} <:dot:1291582825232994305>\`#${droppedCard.copyNumber}\` \n\`\`\`${droppedCard.uniqueCode}\`\`\``);

      // Envía la respuesta con la imagen de la carta
      await interaction.reply({
        embeds: [embed],
        files: [{
          attachment: imgUrl, 
          name: fileCard
        }]
      });

    } catch (error) {
      console.error('Error al ejecutar el comando view:', error);
      await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  },
};
