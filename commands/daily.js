const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Card = require('../models/Card');
const User = require('../models/User');
const DroppedCard = require('../models/DroppedCard');
const updateInventory = require('../utils/updateInventory');
const generateCardCode = require('../utils/generateCardCode');
const incrementCardCount = require('../utils/incrementCardCount');
const getImageExtension = require('../utils/getImageExtension');

// Probabilidades de rareza (porcentaje total debe sumar 100)
const rarityProbabilities = {
  1: 70, // Común
  2: 27, // Poco común
  3: 3   // Raro
};

// Función para obtener una rareza aleatoria basada en las probabilidades
function getRandomRarity(probabilities) {
  const random = Math.random() * 100;
  let cumulativeProbability = 0;

  for (const [rarity, probability] of Object.entries(probabilities)) {
    cumulativeProbability += probability;
    if (random < cumulativeProbability) {
      return rarity; // Devuelve la rareza seleccionada (1, 2, 3)
    }
  }
}

// Función para seleccionar una carta con base en la rareza seleccionada
async function selectCardWithProbability(cards) {
  const selectedRarity = getRandomRarity(rarityProbabilities);

  // Filtra las cartas por rareza
  const filteredCards = cards.filter(card => card.rarity == selectedRarity);

  // Si hay cartas de la rareza seleccionada, elige una aleatoria, si no, elige una carta cualquiera
  return filteredCards.length > 0
    ? filteredCards[Math.floor(Math.random() * filteredCards.length)]
    : cards[Math.floor(Math.random() * cards.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Recibe una carta diaria y 150 monedas.'),

  async execute(interaction) {
    try {
      await interaction.deferReply(); // Indicar que estamos trabajando en la respuesta

      const userId = interaction.user.id;

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

      // Obtener todas las cartas
      const cards = await Card.find();

      // Selecciona una carta aleatoria según las probabilidades
      const selectedCard = await selectCardWithProbability(cards);

      // Generar un código único para la carta obtenida
      const uniqueCode = generateCardCode(selectedCard.idol, selectedCard.grupo, selectedCard.era, String(selectedCard.rarity));
      const cardCode = `${selectedCard.idol[0].toUpperCase()}${selectedCard.grupo[0].toUpperCase()}${selectedCard.era[0].toUpperCase()}${selectedCard.rarity}`;

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
        uniqueCode,
        command: '/daily',
        copyNumber,
      });

      // Guardar la carta caída y actualizar el inventario
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
