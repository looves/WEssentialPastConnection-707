const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const DroppedCard = require('../models/DroppedCard');
const rarityToEmojis = require('../utils/rarityToEmojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('global')
    .setDescription('Busca cartas globalmente.')
    .addStringOption(option =>
      option.setName('idol')
        .setDescription('Nombre del idol')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('grupo')
        .setDescription('Nombre del grupo')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('era')
        .setDescription('Nombre de la era')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('eshort')
        .setDescription('Nombre de la era corta')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('rarity')
        .setDescription('Rareza de la carta')
        .setRequired(false)),

  async execute(interaction) {
    const idolFilter = interaction.options.getString('idol');
    const grupoFilter = interaction.options.getString('grupo');
    const eraFilter = interaction.options.getString('era');
    const eshortFilter = interaction.options.getString('eshort');
    const rarity = interaction.options.getString('rarity');

    try {
      await interaction.deferReply();  // Deferir la respuesta inmediatamente

      // Crea un objeto de filtros que solo contiene las opciones que no son nulas
      const filters = {};
      if (idolFilter) filters.idol = { $regex: idolFilter, $options: 'i' }; // Usamos expresiones regulares para ignorar mayúsculas/minúsculas
      if (grupoFilter) filters.grupo = { $regex: grupoFilter, $options: 'i' };
      if (eraFilter) filters.era = { $regex: eraFilter, $options: 'i' };
      if (eshortFilter) filters.eshort = { $regex: eshortFilter, $options: 'i' };
      if (rarity) filters.rarity = rarity;

      // Obtén el total de cartas que coinciden con los filtros aplicados
      const totalCards = await DroppedCard.countDocuments(filters);

      if (totalCards === 0) {
        return interaction.editReply({ content: 'No se encontraron cartas con los criterios especificados.', ephemeral: true });
      }

      // Pagina los resultados
      const maxFields = 9; // Máximo número de cartas por página
      const totalPages = Math.ceil(totalCards / maxFields);
      let currentPage = 0;

      // Realiza la consulta optimizada con los filtros y la paginación
      const cards = await DroppedCard.find(filters)
        .lean()  // Utilizamos lean() para obtener solo objetos planos (más rápido)
        .select('idol grupo copyNumber rarity uniqueCode userId')  // Seleccionamos solo los campos necesarios
        .skip(currentPage * maxFields)  // Salta los elementos de las páginas anteriores
        .limit(maxFields);  // Limita el número de resultados a los de la página actual

      const createEmbed = (page) => {
        const embed = new EmbedBuilder()
          .setAuthor({ name: `${totalCards} cartas en total`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setColor('#60a5fa')
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        const startIndex = page * maxFields;
        const endIndex = Math.min(startIndex + maxFields, cards.length);
        for (let i = startIndex; i < endIndex; i++) {
          const card = cards[i];
          embed.addFields({
            name: `${card.idol} <:dot:1296707029087555604> \`#${card.copyNumber}\``,
            value: `${rarityToEmojis(card.rarity)} ${card.grupo} ${card.eshort}\n\`\`\`${card.uniqueCode}\`\`\` <@${card.userId}>`,
            inline: true,
          });
        }
        return embed;
      };

      const getButtonRow = (currentPage, totalPages) => {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('first')
              .setEmoji("<:first:1290467842462060605>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage === 0),
            new ButtonBuilder()
              .setCustomId('previous')
              .setEmoji("<:prev:1290467827739787375>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage === 0),
            new ButtonBuilder()
              .setCustomId('close')
              .setEmoji("<:close:1290467856437481574>")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('next')
              .setEmoji("<:next:1290467800065769566>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
              .setCustomId('last')
              .setEmoji("<:last:1290467815127519322>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage >= totalPages - 1)
          );

        return row;
      };

      // Muestra la respuesta inicial con los botones
      const message = await interaction.editReply({
        embeds: [createEmbed(currentPage)],
        components: [getButtonRow(currentPage, totalPages)],
      });

      // Configura el colector de botones
      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        if (i.message.id !== message.id) return;  // Verifica que la interacción pertenezca al mensaje correcto
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'No puedes interactuar con este botón.', ephemeral: true });
        }

        if (i.customId === 'previous' && currentPage > 0) {
          currentPage--;
        } else if (i.customId === 'next' && currentPage < totalPages - 1) {
          currentPage++;
        } else if (i.customId === 'first') {
          currentPage = 0;
        } else if (i.customId === 'last') {
          currentPage = totalPages - 1;
        } else if (i.customId === 'close') {
          await i.update({ content: '**/global cerrado...**', embeds: [], components: [] });
          collector.stop();  // Detener el colector después de cerrar
          return;
        }

        // Actualiza el mensaje con la nueva página
        const newCards = await DroppedCard.find(filters)
          .lean()  // Utilizamos lean() para una consulta más rápida
          .select('idol grupo copyNumber rarity uniqueCode userId')  // Seleccionamos solo los campos necesarios
          .skip(currentPage * maxFields)
          .limit(maxFields);

        await i.update({
          embeds: [createEmbed(currentPage)],
          components: [getButtonRow(currentPage, totalPages)],
        });
      });

      collector.on('end', async () => {
        // Deshabilita los botones después de que termine el tiempo
        await message.edit({ components: [] });
      });

    } catch (error) {
      console.error('Error al ejecutar el comando /global:', error);
      await interaction.editReply({ content: 'Hubo un error al procesar el comando. Por favor, inténtalo de nuevo.', ephemeral: true });
    }
  }
};
