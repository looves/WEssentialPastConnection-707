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
    const idol = interaction.options.getString('idol');
    const grupo = interaction.options.getString('grupo');
    const era = interaction.options.getString('era');
    const eshort = interaction.options.getString('eshort');
    const rarity = interaction.options.getString('rarity');

    const filters = {};
    if (idol) filters.idol = { $regex: new RegExp(idol, 'i') };
    if (grupo) filters.grupo = { $regex: new RegExp(grupo, 'i') };
    if (era) filters.era = { $regex: new RegExp(era, 'i') };
    if (eshort) filters.eshort = { $regex: new RegExp(eshort, 'i') };
    if (rarity) filters.rarity = rarity;

    try {
      const droppedCards = await DroppedCard.find(filters);
      const maxFields = 9;
      const totalPages = Math.ceil(droppedCards.length / maxFields);
      let currentPage = 0;

      if (droppedCards.length === 0) {
        return interaction.reply({ content: 'No se encontraron cartas con los criterios especificados.', ephemeral: true });
      }

      const createEmbed = (page) => {
        const embed = new EmbedBuilder()
          .setAuthor({ name: `${droppedCards.length} cards in total`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setColor('#60a5fa')
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        const startIndex = page * maxFields;
        const endIndex = Math.min(startIndex + maxFields, droppedCards.length);
        for (let i = startIndex; i < endIndex; i++) {
          const card = droppedCards[i];
          embed.addFields({
            name: `${card.idol} <:dot:1296707029087555604> \`#${card.copyNumber}\``,
            value: `${rarityToEmojis(card.rarity)} ${card.grupo} ${card.eshort}\n\`\`\`${card.uniqueCode}\`\`\`<@${card.userId}>`,
            inline: true,
          });
        }
        return embed;
      };

      // Mueve esta función aquí arriba
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

      const message = await interaction.reply({ embeds: [createEmbed(currentPage)], components: [getButtonRow(currentPage, totalPages)], fetchReply: true });

      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
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
          await i.update({ content: 'Global cerrado...', embeds: [], components: [] });
          return collector.stop();
        }

        await i.update({ embeds: [createEmbed(currentPage)], components: [getButtonRow(currentPage, totalPages)] });
      });

      collector.on('end', async () => {
        await message.edit({ components: [] });
      });

    } catch (error) {
      console.error('Error al ejecutar el comando /global:', error);
      await interaction.reply({ content: 'Ocurrió un error al buscar las cartas. Por favor, inténtalo de nuevo.', ephemeral: true });
    }
  },
};
