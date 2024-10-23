const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checklist')
    .setDescription('Muestra las cartas que faltan para completar por idol o grupo.')
    .addStringOption(option =>
      option.setName('idol')
        .setDescription('El idol que deseas buscar'))
    .addStringOption(option =>
      option.setName('grupo')
        .setDescription('El grupo que deseas buscar')),

  async execute(interaction) {
    const idolFilter = interaction.options.getString('idol');
    const grupoFilter = interaction.options.getString('grupo');
    const itemsPerPage = 2; // Número de ítems a mostrar por página

    try {
      let filter = {};
      if (idolFilter) filter.idol = new RegExp(idolFilter, 'i');
      if (grupoFilter) filter.grupo = new RegExp(grupoFilter, 'i');

      const allCards = await Card.find(filter);
      if (allCards.length === 0) {
        return interaction.reply(`No se encontraron cartas para el idol ${idolFilter || ''} en el grupo ${grupoFilter || ''}.`);
      }

      const userCards = await DroppedCard.find({ userId: interaction.user.id });
      const checklist = {};

      // Acumular los ídolos en el checklist
      allCards.forEach(card => {
        const key = `${card.grupo}-${card.era}-${card.eshort}`;
        if (!checklist[key]) {
          checklist[key] = {};
        }

        if (!checklist[key][card.idol]) {
          checklist[key][card.idol] = { rarity1: false, rarity2: false, rarity3: false };
        }

        const hasCard = userCards.find(droppedCard =>
          droppedCard.idol === card.idol &&
          droppedCard.grupo === card.grupo &&
          droppedCard.era === card.era &&
          droppedCard.eshort === card.eshort &&
          droppedCard.rarity === card.rarity
        );

        if (hasCard) {
          checklist[key][card.idol][`rarity${card.rarity}`] = true;
        }
      });

      // Convertir el checklist a un array y ordenarlo alfabéticamente
      const entries = Object.entries(checklist);
      entries.forEach(([key, idols]) => {
        checklist[key] = Object.fromEntries(Object.entries(idols).sort());
      });

      // Ordenar los keys del checklist alfabéticamente
      entries.sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

      let currentPage = 0;
      const totalPages = Math.ceil(entries.length / itemsPerPage);

      const createEmbed = (page) => {
        const embed = new EmbedBuilder()
          .setTitle('CHECKLIST CARDS')
          .setColor('#60a5fa')
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        let description = '';

        entries.slice(start, end).forEach(([key, idols]) => {
          const [grupo, era, eshort] = key.split('-');

          description += `<:last:1290467815127519322> **${grupo}**\n` +
                         `_ _ <:next:1290467800065769566> ${era} \`${eshort}\`\n`;

          for (const [idol, rarities] of Object.entries(idols)) {
            const rarityDisplay = 
              `${rarities.rarity1 ? '<:stars:1294530231561879633>' : '<:mstars:1291582844011020398>'}` +
              `${rarities.rarity2 ? '<:stars:1294530231561879633>' : '<:mstars:1291582844011020398>'}` +
              `${rarities.rarity3 ? '<:stars:1294530231561879633>' : '<:mstars:1291582844011020398>'}`;

            description += `ㅤ<:dot:1291582825232994305>${rarityDisplay}ㅤ${idol}\n`;
          }

          description += '\n';
        });

        embed.setDescription(description || 'No hay cartas para mostrar.');

        return embed;
      };



      const createButtons = (page) => {
        return new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('first')
              .setEmoji("<:first:1290467842462060605>")
              .setStyle(ButtonStyle.Secondary) // Color plomo
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('prev')
              .setEmoji("<:prev:1290467827739787375>")
              .setStyle(ButtonStyle.Secondary) // Color plomo
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('next')
              .setEmoji("<:next:1290467800065769566>")
              .setStyle(ButtonStyle.Secondary) // Color plomo
              .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
              .setCustomId('last')
              .setEmoji("<:last:1290467815127519322>")
              .setStyle(ButtonStyle.Secondary) // Color plomo
              .setDisabled(page === totalPages - 1)
          );
      };

      await interaction.reply({ embeds: [createEmbed(currentPage)], components: [createButtons(currentPage)] });

      const collector = interaction.channel.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) return;

        if (i.customId === 'first') currentPage = 0;
        if (i.customId === 'prev' && currentPage > 0) currentPage--;
        if (i.customId === 'next' && currentPage < totalPages - 1) currentPage++;
        if (i.customId === 'last') currentPage = totalPages - 1;

        await i.update({ embeds: [createEmbed(currentPage)], components: [createButtons(currentPage)] });
      });

      collector.on('end', async () => {
        await interaction.editReply({ components: [] }); // Deshabilitar los botones cuando termine el tiempo
      });

    } catch (error) {
      console.error('Error en el comando /checklist:', error);
      await interaction.reply('Hubo un error al procesar el comando.');
    }
  },
};
