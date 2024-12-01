const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');

// Función para escapar caracteres especiales en una expresión regular
function escapeRegExp(string) {
  return string.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, '\\$&'); // Escapa todos los caracteres especiales
}

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

      // Si hay filtro para idol, lo añadimos
      if (idolFilter) filter.idol = new RegExp(idolFilter, 'i');

      // Si hay filtro para grupo, lo escapamos y lo añadimos
      if (grupoFilter) {
        const escapedGrupoFilter = escapeRegExp(grupoFilter.trim());
        filter.grupo = new RegExp(escapedGrupoFilter, 'i'); // Búsqueda insensible a mayúsculas/minúsculas
      }

      // Optimización: Usar proyecciones para obtener solo los campos necesarios
      const allCards = await Card.find(filter)
        .select('idol grupo era eshort rarity') // Seleccionar solo los campos necesarios
        .lean(); // Usar `lean()` para mejorar el rendimiento

      if (allCards.length === 0) {
        return interaction.reply(`No se encontraron cartas para el idol ${idolFilter || ''} en el grupo ${grupoFilter || ''}.`);
      }

      // Optimización: Usar un Set para las cartas del usuario (esto reduce el tiempo de búsqueda)
      const userCards = await DroppedCard.find({ userId: interaction.user.id }).lean();
      const userCardSet = new Set(userCards.map(card => `${card.idol}|${card.grupo}|${card.era}|${card.eshort}|${card.rarity}`));

      const checklist = {};

      // Acumular los ídolos en el checklist
      allCards.forEach(card => {
        const key = `${card.grupo}|${card.era}|${card.eshort}`;
        if (!checklist[key]) {
          checklist[key] = {};
        }

        if (!checklist[key][card.idol]) {
          checklist[key][card.idol] = { rarity1: false, rarity2: false, rarity3: false };
        }

        // Verificar si el usuario tiene la carta utilizando el Set
        const cardIdentifier = `${card.idol}|${card.grupo}|${card.era}|${card.eshort}|${card.rarity}`;
        if (userCardSet.has(cardIdentifier)) {
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

      // Función para crear el embed
      const createEmbed = (page) => {
        const embed = new EmbedBuilder()
          .setTitle('CHECKLIST CARDS')
          .setColor('#60a5fa')
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        let description = '';

        entries.slice(start, end).forEach(([key, idols]) => {
          const [grupo, era, eshort] = key.split('|');

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

      // Función para crear los botones de navegación
      const createButtons = (page) => {
        return new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('first')
              .setEmoji("<:first:1290467842462060605>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('prev')
              .setEmoji("<:prev:1290467827739787375>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId('close')
              .setEmoji("<:close:1290467856437481574>")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('next')
              .setEmoji("<:next:1290467800065769566>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
              .setCustomId('last')
              .setEmoji("<:last:1290467815127519322>")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === totalPages - 1)
          );
      };

      // Deferir la respuesta para habilitar los botones interactivos
      await interaction.deferReply();

      // Enviar la respuesta inicial
      const message = await interaction.editReply({ embeds: [createEmbed(currentPage)], components: [createButtons(currentPage)] });

      // Configurar el colector de botones
      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        // Asegurarse de que la interacción sea solo del usuario que ejecutó el comando
        if (i.user.id !== interaction.user.id) return;

        // Navegación de páginas
        if (i.customId === 'first') currentPage = 0;
        if (i.customId === 'prev' && currentPage > 0) currentPage--;
        if (i.customId === 'next' && currentPage < totalPages - 1) currentPage++;
        if (i.customId === 'last') currentPage = totalPages - 1;
        if (i.customId === 'close') {
          await i.update({ content: `**</checklist:1291579000044650507> cerrado...**`, embeds: [], components: [] });
          collector.stop();  // Detener el colector cuando se cierre
          return;
        }

        // Actualizar el embed y los botones
        await i.update({
          embeds: [createEmbed(currentPage)],
          components: [createButtons(currentPage)],
        });
      });

      collector.on('end', async () => {
        await message.edit({ components: [] }); // Deshabilitar los botones cuando termine el tiempo
      });

    } catch (error) {
      console.error('Error en el comando /checklist:', error);
      await interaction.editReply('Hubo un error al procesar el comando.');
    }
  },
};
