const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Card = require('../models/Card');
const User = require('../models/User');
const DroppedCard = require('../models/DroppedCard');
const updateInventory = require('../utils/updateInventory');
const generateCardCode = require('../utils/generateCardCode');
const incrementCardCount = require('../utils/incrementCardCount');
const getImageExtension = require('../utils/getImageExtension');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Recibe una carta diaria y 150 monedas.'),

  async execute(interaction) {
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
        content: `Ya has reclamado tu recompensa diaria. Puedes reclamarla de nuevo en ${timeRemaining.getUTCHours()} horas y ${timeRemaining.getUTCMinutes()} minutos.`,
        ephemeral: true,
      });
    }

    // Selecciona una carta aleatoria
    const cards = await Card.find();
    const randomCard = cards[Math.floor(Math.random() * cards.length)];

    // Generar un código único para la carta obtenida
    const uniqueCode = generateCardCode(randomCard.idol, randomCard.grupo, randomCard.era, String(randomCard.rarity));
    const cardCode = `${randomCard.idol[0].toUpperCase()}${randomCard.grupo[0].toUpperCase()}${randomCard.era[0].toUpperCase()}${randomCard.rarity}`;

    // Incrementar el contador y actualizar el inventario en paralelo
    const incrementPromise = incrementCardCount(userId, randomCard._id);

    try {
      const { copyNumber } = await incrementPromise;

      // Asegúrate de que hay copias disponibles
      if (copyNumber <= 0) {
        return interaction.followUp('No se pudo incrementar el contador de la carta.');
      }

      // Crear la carta caída
      const droppedCard = new DroppedCard({
        userId,
        cardId: randomCard._id,
        idol: randomCard.idol,
        grupo: randomCard.grupo,
        era: randomCard.era,
        eshort: randomCard.eshort,
        rarity: randomCard.rarity,
        uniqueCode,
        command: '/daily',
        copyNumber,
      });

      // Guardar la carta caída y actualizar el inventario
      await Promise.all([
        droppedCard.save(),
        updateInventory(userId, [{ cardId: randomCard._id, count: copyNumber }])
      ]);

      // Añadir monedas al usuario y actualizar la fecha
      user.coins += 150;
      user.lastDaily = currentTime;
      await user.save();

      // Define la extensión del archivo en función de la imagen
      const imageUrl = randomCard.image;
      const extension = getImageExtension(imageUrl);
      const fileName = `${cardCode}${extension}`;

      // Crear el embed
      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setFooter({ text: "Gracias por usar el bot" })
        .setDescription(`<@${interaction.user.id}>, ganaste 150 :coin: coins y una **carta** \n\`\`\`${uniqueCode}\`\`\``);

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
      await interaction.followUp('Ocurrió un error al procesar el comando.');
    }
  },
};
