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
      // Deferir la respuesta
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

    try {
      // Paginación: Definir la página y número máximo de cartas por página
      const maxFields = 9;
      let currentPage = 0;  // Página inicial


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

      // Obtener el total de cartas que coinciden con el filtro
      const totalCards = await DroppedCard.countDocuments(query);

      if (totalCards === 0) {
        return interaction.editReply('No tienes cartas en tu inventario.'); // Cambiado a editReply
      }

      const totalPages = Math.ceil(totalCards / maxFields);

      // Función para generar el embed de una página
      const generateEmbed = async (page) => {
        const skip = page * maxFields;
        const cards = await DroppedCard.find(query)  // Realizar la consulta con los filtros
          .select('idol eshort grupo copyNumber rarity uniqueCode') // Seleccionar solo los campos necesarios
          .skip(skip)  // Omitir las cartas de páginas anteriores
          .limit(maxFields)  // Limitar a las cartas de la página actual
          .lean();  // Usar lean para mejorar el rendimiento

        const embed = new EmbedBuilder()
          .setAuthor({ name: `${user.username}'s Inventory`, iconURL: user.displayAvatarURL() })
          .setTimestamp()
          .setColor('#60a5fa')
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        cards.forEach(card => {
          embed.addFields({
            name: `${card.idol} <:dot:1296707029087555604> \`#${card.copyNumber}\``,
            value: `${rarityToEmojis(card.rarity)} ${card.grupo} ${card.eshort}\n\`\`\`${card.uniqueCode}\`\`\``,
            inline: true,
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
        embeds: [await generateEmbed(currentPage)], // editReply en lugar de reply
        components: [getButtonRow(currentPage)],
        fetchReply: true
      });

      // Crear un collector para manejar las interacciones de botones
      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        // Verifica que la interacción pertenezca al mensaje correcto
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
          await i.update({ content: '**/inventory cerrado...**', embeds: [], components: [] });
          return collector.stop(); // Detener el colector después de cerrar
        }

        // Solo actualizamos si la interacción no fue cerrada
        await i.update({ embeds: [await generateEmbed(currentPage)], components: [getButtonRow(currentPage)] });
      });

      collector.on('end', async () => {
        await message.edit({ components: [] }); // Se eliminan los botones después de que termine la interacción
      });

    } catch (error) {
      console.error('Error al ejecutar el comando /inventory:', error);
      await interaction.editReply('Ocurrió un error al procesar el comando.'); // Cambiado a editReply
    }
  },
};
