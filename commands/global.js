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
        .setRequired(false))
    .addStringOption(option =>
      option.setName('event')
       .setDescription('Filtra por evento de la carta.')
       .setRequired(false))
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

  async execute(interaction) {
    const idolFilter = interaction.options.getString('idol');
    const grupoFilter = interaction.options.getString('grupo');
    const eraFilter = interaction.options.getString('era');
    const eshortFilter = interaction.options.getString('eshort');
    const rarity = interaction.options.getString('rarity');
    const eventFilter = interaction.options.getString('event');

    try {
      await interaction.deferReply();  // Deferir la respuesta inmediatamente

    const escapeRegex = (text) => {
  return text.replace(/[.*+?^=!:${}()|\[\]\/\\]/g, '\\$&'); // Escapa los caracteres especiales
};

      // Filtrar las cartas en la base de datos
      const query = {};
      if (idolFilter) query.idol = new RegExp(escapeRegex(idolFilter), 'i');
      if (grupoFilter) query.grupo = new RegExp(escapeRegex(grupoFilter), 'i');
      if (eraFilter) query.era = new RegExp(escapeRegex(eraFilter), 'i');
      if (eshortFilter) query.eshort = new RegExp(eshortFilter, 'i');
      if (rarity) query.rarity = rarity;
      if (eventFilter) query.event = new RegExp(escapeRegex(eventFilter), 'i');

      // Total de cartas que coinciden con el filtro
      const totalCards = await DroppedCard.countDocuments(query);

      // Configuración de la paginación
      const maxFields = 9;  // Mostrar 9 cartas por página
      const totalPages = Math.ceil(totalCards / maxFields);
      let currentPage = 0;  // Página inicial

      if (totalCards === 0) {
        return interaction.editReply({ content: 'No se encontraron cartas con los criterios especificados.', ephemeral: true });
      }

      // Crear embed para mostrar las cartas
      const createEmbed = async (page) => {
        const cards = await DroppedCard.find(query)  // Aplicar el filtro de búsqueda
          .select('idol eshort grupo copyNumber rarity uniqueCode userId event')  // Seleccionar solo los campos necesarios
          .skip(page * maxFields)  // Omitir los resultados anteriores
          .limit(maxFields)  // Limitar a 9 resultados
          .lean();  // Utilizar lean para mejorar el rendimiento

        const embed = new EmbedBuilder()
          .setAuthor({ name: `${totalCards} cartas en total`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
          .setColor('#60a5fa')
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        cards.forEach(card => {
          // Verificamos si la carta tiene un evento
          let emoji = rarityToEmojis(card.rarity);  // Emoji de rareza por defecto

          // Si la carta tiene evento, mostramos el emoji del evento
          if (card.event) {
            emoji = rarityToEmojis(card.event);  // Emoji del evento
          }

          embed.addFields({
            name: `${card.idol} <:dot:1296707029087555604> \`#${card.copyNumber}\``,
            value: `${rarityToEmojis(card.rarity)} ${card.grupo} ${card.eshort}\n\`\`\`${card.uniqueCode}\`\`\` <@${card.userId}>`,
            inline: true,
          });
        });

        return embed;
      };

      // Botones de navegación
      const getButtonRow = (currentPage, totalPages) => {
        return new ActionRowBuilder()
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
      };

      // Mostrar la respuesta inicial con los botones
      const message = await interaction.editReply({
        embeds: [await createEmbed(currentPage)],
        components: [getButtonRow(currentPage, totalPages)],
      });

      // Configurar el colector de botones
      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        // Verifica que la interacción pertenece al mensaje correcto
        if (i.message.id !== message.id) return;

        // Verifica que el usuario es el que ejecutó el comando
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
          await i.update({ content: `**</global:1291579000044650512> cerrado...**`, embeds: [], components: [] });
          collector.stop();  // Detener el colector después de cerrar
          return;
        }

        // Actualizar el mensaje con la nueva página
        await i.update({
          embeds: [await createEmbed(currentPage)],
          components: [getButtonRow(currentPage, totalPages)],
        });
      });

      collector.on('end', async () => {
        try {
          // Si el mensaje sigue estando accesible, usa `message.edit()` para deshabilitar los botones
          if (message.channel?.isTextBased() && message.channel.viewable) {
            await message.edit({ components: [] }); // Deshabilitar los botones
          }
        } catch (error) {
          console.error("Error al actualizar los componentes:", error);
        }
      });

    } catch (error) {
      console.error('Error al ejecutar el comando /global:', error);
      await interaction.editReply({ content: 'Hubo un error al procesar el comando. Por favor, inténtalo de nuevo.', ephemeral: true });
    }
  }
};
