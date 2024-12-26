const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Card = require('../models/Card');
const User = require('../models/User');
const DroppedCard = require('../models/DroppedCard');
const updateInventory = require('../utils/updateInventory');
const generateCardCode = require('../utils/generateCardCode');
const incrementCardCount = require('../utils/incrementCardCount');
const getImageExtension = require('../utils/getImageExtension');
const checkBan = require('../utils/checkBan'); // Importamos el utilitario checkBan

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Recibe una carta diaria y 150 monedas.')
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

  async execute(interaction) {
    try {
      await interaction.deferReply(); // Indicar que estamos trabajando en la respuesta

      const userId = interaction.user.id;

      // Verificar si el usuario está baneado
      const isBanned = await checkBan(userId);
      if (isBanned) {
        return interaction.followUp({
          content: `Estás baneado y no puedes usar </daily:1305655606627139644>`,
          ephemeral: true,
        });
      }

      // Crear o actualizar el usuario sin esperar
      await User.findOneAndUpdate(
        { userId },
        { $setOnInsert: { coins: 0, lastDaily: null } },
        { upsert: true }
      );

      const currentTime = new Date();
      const oneDay = 24 * 60 * 60 * 1000; // Milisegundos en un día

      // Obtener el usuario actualizado
      const user = await User.findOne({ userId });

      // Verificar si ya ha reclamado la recompensa diaria
      if (user.lastDaily && currentTime - user.lastDaily < oneDay) {
        const timeRemaining = new Date(oneDay - (currentTime - user.lastDaily));
        return interaction.followUp({
          content: `Ya has reclamado tu recompensa diaria. Puedes reclamarla de nuevo en \`${timeRemaining.getUTCHours()}\` horas y \`${timeRemaining.getUTCMinutes()}\` minutos.`,
          ephemeral: true,
        });
      }

      // Obtener cartas con rareza 2
      const cards = await Card.find({ rarity: 2 }).limit(700); // Limitar la cantidad de resultados para evitar problemas de memoria

      // Verificar si hay cartas con rareza 2 disponibles
      if (cards.length === 0) {
        return interaction.followUp({
          content: 'No hay cartas con rareza 2 disponibles.',
          ephemeral: true,
        });
      }

      // Selecciona una carta aleatoria entre las cartas con rareza 2
      const selectedCard = cards[Math.floor(Math.random() * cards.length)];

      // Generar un código único para la carta obtenida
      const uniqueCode = generateCardCode(selectedCard.idol, selectedCard.grupo, selectedCard.era, String(selectedCard.rarity), selectedCard.event);
      const cardCode = `${selectedCard.idol[0]}${selectedCard.grupo[0]}${selectedCard.era[0]}${selectedCard.event || selectedCard.rarity}`;

      // Incrementar el contador y actualizar el inventario en paralelo
      const incrementPromise = incrementCardCount(userId, selectedCard._id);

      const { copyNumber } = await incrementPromise;

      // Asegúrate de que hay copias disponibles
      if (copyNumber <= 0) {
        return interaction.followUp('No se pudo incrementar el contador de la carta.');
      }

      // Crear la carta caída
      const droppedCard = new DroppedCard({
        userId,
        cardId: selectedCard._id,
        idol: selectedCard.idol,
        grupo: selectedCard.grupo,
        era: selectedCard.era,
        eshort: selectedCard.eshort,
        rarity: selectedCard.rarity,
        event: selectedCard.event,
        uniqueCode,
        command: '/daily',
        copyNumber,
      });

      // Operaciones en paralelo para guardar la carta caída y actualizar el inventario
      await Promise.all([
        droppedCard.save(),
        updateInventory(userId, [{ cardId: selectedCard._id, count: copyNumber }])
      ]);

      // Añadir monedas al usuario y actualizar la fecha
      user.coins += 150;
      user.lastDaily = currentTime;
      await user.save();

      // Define la extensión del archivo en función de la imagen
      const imageUrl = selectedCard.image;
      const extension = getImageExtension(imageUrl);
      const fileName = `${cardCode}${extension}`;

      // Crear el embed
      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setFooter({ text: "Gracias por usar el bot!" })
        .setDescription(`<@${interaction.user.id}>, ganaste 150 monedas y una **carta** \n\`\`\`${uniqueCode}\`\`\``);

      // Envía la respuesta con la imagen de la carta
      await interaction.editReply({
        embeds: [embed],
        files: [{
          attachment: imageUrl,
          name: fileName
        }]
      });

    } catch (error) {
      console.error('Error al procesar el comando /daily:', error);
      await interaction.followUp('Ocurrió un error al procesar el comando. Por favor, intenta de nuevo más tarde.');
    }
  },
};
