const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const DroppedCard = require('../models/DroppedCard');
const rarityToEmojis = require('../utils/rarityToEmojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Muestra todas las cartas en tu inventario.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Usuario cuyo inventario deseas ver.'))
    .addStringOption(option =>
      option.setName('idol')
        .setDescription('Filtra por nombre de la carta.'))
    .addStringOption(option =>
      option.setName('grupo')
        .setDescription('Filtra por grupo de la carta.'))
    .addStringOption(option =>
      option.setName('era')
        .setDescription('Filtra por era de la carta.'))
    .addStringOption(option =>
      option.setName('eshort')
        .setDescription('Filtra por era corta de la carta.'))
    .addStringOption(option =>
      option.setName('rarity')
        .setDescription('Filtra por rareza de la carta.')),

  async execute(interaction) {
    try {
      // Defer the reply
      await interaction.deferReply();
    } catch (error) {
      console.error('Error al deferir la respuesta:', error);
      return; // Termina la ejecución del comando si ocurre un error
    }

    const userId = interaction.options.getUser('user')?.id || interaction.user.id;
    const idolFilter = interaction.options.getString('idol');
    const grupoFilter = interaction.options.getString('grupo');
    const eraFilter = interaction.options.getString('era');
    const eshortFilter = interaction.options.getString('eshort');
    const rarityFilter = interaction.options.getString('rarity');

    const user = await interaction.client.users.fetch(userId);
    let isInteractionClosed = false; // Bandera para controlar si la interacción fue cerrada

    try {
      // Encuentra todas las cartas caídas del usuario
      const droppedCards = await DroppedCard.find({ userId });

      if (droppedCards.length === 0) {
        return interaction.editReply('No tienes cartas en tu inventario.'); // Cambiado a editReply
      }

      // Filtrar las cartas según los criterios especificados
      let filteredCards = droppedCards;

      const cleanString = (str) => {
        return String(str).replace(/[^\w\s]/g, '').toLowerCase(); // Limpiar caracteres especiales
      };

      if (idolFilter) {
        filteredCards = filteredCards.filter(card => card.idol && card.idol.toLowerCase().includes(idolFilter.toLowerCase()));
      }
      if (grupoFilter) {
        filteredCards = filteredCards.filter(card => card.grupo && cleanString(card.grupo).includes(cleanString(grupoFilter)));
      }    
      if (eraFilter) {
        filteredCards = filteredCards.filter(card => card.era && cleanString(card.era).includes(cleanString(eraFilter)));
      }
      if (eshortFilter) {
        filteredCards = filteredCards.filter(card => card.eshort && card.eshort.toLowerCase().includes(eshortFilter.toLowerCase()));
      }
      if (rarityFilter) {
        filteredCards = filteredCards.filter(card => card.rarity && card.rarity.toLowerCase().includes(rarityFilter.toLowerCase()));
      }      

      if (filteredCards.length === 0) {
        return interaction.editReply({ content: 'No se encontraron cartas en tu inventario que coincidan con los filtros especificados.', ephemeral: true });
      }

      // Crea un mapa para guardar las cartas y sus detalles
      const cardDetailsMap = {};

      // Agrega los detalles de las cartas desde DroppedCard
      filteredCards.forEach(droppedCard => {
        const key = `${droppedCard.idol} (${droppedCard.grupo}) - Código: ${droppedCard.uniqueCode}`;
        if (!cardDetailsMap[key]) {
          cardDetailsMap[key] = {
            idol: droppedCard.idol,
            grupo: droppedCard.grupo,
            era: droppedCard.era,
            eshort: droppedCard.eshort,
            rarity: droppedCard.rarity,
            copies: [],
          };
        }
        cardDetailsMap[key].copies.push({
          copyNumber: droppedCard.copyNumber,
          uniqueCode: droppedCard.uniqueCode,
        });
      });

      // Preparar la paginación basada en el número de cartas filtradas
      const totalCards = Object.keys(cardDetailsMap).length;
      const maxFields = 9; // Máximo de campos (fields) por página
      const totalPages = Math.ceil(totalCards / maxFields);
      let currentPage = 0;

      const generateEmbed = (page) => {
        const embed = new EmbedBuilder()
          .setAuthor({ name: `${user.username}'s Inventory`, iconURL: user.displayAvatarURL() })
          .setTimestamp()
          .setColor('#60a5fa')
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        const start = page * maxFields;
        const end = start + maxFields;
        const pageItems = Object.entries(cardDetailsMap).slice(start, end);

        pageItems.forEach(([key, cardDetails]) => {
          cardDetails.copies.forEach(copy => {
            embed.addFields({
              name: `${cardDetails.idol} <:dot:1296707029087555604> \`#${copy.copyNumber}\``,
              value: `${rarityToEmojis(cardDetails.rarity)} ${cardDetails.grupo} ${cardDetails.eshort}\n\`\`\`${copy.uniqueCode}\`\`\``,
              inline: true,
            });
          });
        });

        return embed;
      };

      const getButtonRow = (page) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('first')
            .setEmoji("<:first:1290467842462060605>") // Primera Página
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('previous')
            .setEmoji("<:prev:1290467827739787375>") // Anterior
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('close')
            .setEmoji("<:close:1290467856437481574>") // Cerrar Inventario
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('next')
            .setEmoji("<:next:1290467800065769566>") // Siguiente
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1),
          new ButtonBuilder()
            .setCustomId('last')  // Última Página
            .setEmoji("<:last:1290467815127519322>")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1)
        );
      };

      // Enviar el primer embed y los botones
      const message = await interaction.editReply({
        embeds: [generateEmbed(currentPage)], // editReply en lugar de reply
        components: [getButtonRow(currentPage)],
        fetchReply: true
      });

      // Crear un collector para manejar las interacciones de botones
      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'No puedes interactuar con este botón.', ephemeral: true });
        }

        if (isInteractionClosed) {
          return; // Si la interacción ya fue cerrada, no realizamos ninguna acción
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
          isInteractionClosed = true; 
          return collector.stop(); // Detener el colector después de cerrar
        }

        // Solo actualizamos si la interacción no fue cerrada
        await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtonRow(currentPage)] });
      });

      collector.on('end', async () => {
        await message.edit({ content: '**/inventory cerrado...**', embeds: [], components: [] });
      });

    } catch (error) {
      console.error('Error al ejecutar el comando /inventory:', error);
      await interaction.editReply('Ocurrió un error al procesar el comando.'); // Cambiado a editReply
    }
  },
};
