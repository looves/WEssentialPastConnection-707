const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');
const User = require('../models/User');
const updateInventory = require('../utils/updateInventory'); 
const incrementCardCount = require('../utils/incrementCardCount');
const generateCardCode = require('../utils/generateCardCode');
const getImageExtension = require('../utils/getImageExtension');
const db = require('../db'); // Importa tu módulo de base de datos
const { selectCard } = require('../utils/rarityUtils'); // Importa selectCard

const BOOSTER_ROLE_ID = '1077366130915672165';
const cooldownTime = 8 * 60 * 1000; // 8 minutos


async function saveUser(userId, tag) {
  await User.findOneAndUpdate(
    { userId },
    { $setOnInsert: { username: tag } },
    { upsert: true }
  );
}

function cardCodeImg(idol, grupo, era, rarity) {
  return `${idol[0].toUpperCase()}${grupo[0].toUpperCase()}${era[0].toUpperCase()}${rarity}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drop')
    .setDescription('Muestra una carta aleatoria y aumenta su contador'),

  async execute(interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const currentTime = Date.now();

    // Crear o actualizar el usuario
    await saveUser(userId, interaction.user.tag);
    const user = await User.findOne({ userId });

    // Verificar cooldown
    if (user.lastDrop) {
      const lastDropTime = new Date(user.lastDrop).getTime();
      const timeElapsed = currentTime - lastDropTime;

      if (timeElapsed < cooldownTime) {
        const remainingTime = cooldownTime - timeElapsed;
        const minutes = Math.floor(remainingTime / 60000);
        const seconds = Math.floor((remainingTime % 60000) / 1000);
        return interaction.editReply(`¡Debes esperar ${minutes} minutos y ${seconds} segundos antes de usar el comando **/drop** nuevamente!`);
      }
    }

    // Obtener todas las cartas
    try {
      const cards = await db.fetchData(); // Obtener todas las cartas de la base de datos

      if (cards.length === 0) {
        return interaction.editReply('No hay cartas disponibles en la base de datos.');
      }

      // Obtener el miembro y verificar rol
      const member = await interaction.guild.members.fetch(userId);
      const selectedCard = await selectCard(cards, member); // Usar selectCard para elegir la carta

      const uniqueCode = generateCardCode(selectedCard.idol, selectedCard.grupo, selectedCard.era, String(selectedCard.rarity));
      const cardCode = cardCodeImg(selectedCard.idol, selectedCard.grupo, selectedCard.era, selectedCard.rarity);

      // Incrementar contador y guardar en paralelo
      const incrementPromise = incrementCardCount(userId, selectedCard._id);
      const { copyNumber } = await incrementPromise;

      if (copyNumber <= 0) {
        return interaction.editReply('No se pudo incrementar el contador de la carta.');
      }

      const droppedCard = new DroppedCard({
        userId,
        cardId: selectedCard._id,
        idol: selectedCard.idol,
        grupo: selectedCard.grupo,
        era: selectedCard.era,
        eshort: selectedCard.eshort,
        rarity: selectedCard.rarity,
        uniqueCode,
        command: '/drop',
        copyNumber
      });

      // Guardar la carta caída y actualizar el inventario en paralelo
      await Promise.all([
        droppedCard.save(),
        updateInventory(userId, [{ cardId: selectedCard._id, count: copyNumber }]),
        User.findOneAndUpdate({ userId }, { lastDrop: new Date() })
      ]);

      // Crear la imagen como un archivo
      const imageUrl = selectedCard.image;
      const extension = getImageExtension(imageUrl);
      const fileName = `${cardCode}${extension}`;
      const attachment = new AttachmentBuilder(imageUrl, { name: fileName });

      const level = member.roles.cache.has(BOOSTER_ROLE_ID) ? 'Level B' : 'Level 0';
      
      // Crear el embed
      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setDescription(`_ _<@${interaction.user.id}>, adquiriste a \`${selectedCard.idol}\` de **${selectedCard.grupo}**\n_ _ **${selectedCard.era}** <:dot:1291582825232994305> \`#${copyNumber}\`\n_ _ \`\`\`${uniqueCode}\`\`\`\n_ _　[server support](https://discord.gg/wonho) | ${level}`);

      // Enviar la imagen y el embed en el mismo mensaje
      await interaction.editReply({ embeds: [embed], files: [attachment] });

      // Configurar la notificación para el cooldown
      setTimeout(() => {
        interaction.channel.send(`<@${userId}>, el comando **/drop** ya está disponible nuevamente!`).catch(console.error);
      }, cooldownTime);

    } catch (error) {
      console.error('Error al procesar el comando /drop:', error);
      await interaction.editReply('Hubo un error al intentar obtener la carta. Por favor, inténtalo de nuevo.');
    }
  },
};
