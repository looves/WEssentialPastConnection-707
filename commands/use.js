const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Inventory = require('../models/Inventory');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');
const packs = require('../utils/UtilsPacks');
const generateCardCode = require('../utils/generateCardCode');
const incrementCardCount = require('../utils/incrementCardCount');
const rarityToEmojis = require('../utils/rarityToEmojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Usa una caja de cartas.')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('El ID de la caja que deseas usar.')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const userId = interaction.user.id;

    // Obtener el inventario del usuario
    const inventory = await Inventory.findOne({ userId });
    if (!inventory || !inventory.packs || Object.keys(inventory.packs).length === 0) {
      return interaction.respond([]); // No tiene packs, no mostrar opciones
    }

    // Obtener los nombres de los packs disponibles en el inventario
    const availablePacks = Object.keys(inventory.packs)
      .filter(packName => packs.some(pack => pack.name === packName)) // Solo mostrar packs válidos
      .map(packName => ({ name: packName, value: packName }));

    await interaction.respond(availablePacks.slice(0, 25)); // Discord permite máx. 25 opciones
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    const item = interaction.options.getString('item');

    // Verificar si la caja existe en UtilsPacks
    const packInfo = packs.find(pack => pack.id === item);
    if (!packInfo) {
      return interaction.reply({ content: `La caja **${item}** no existe.`, ephemeral: true });
    }

    try {
      // Buscar inventario del usuario
      const inventory = await Inventory.findOne({ userId });

      if (!inventory || !inventory.packs[item]) {
        return interaction.reply({
          content: 'No tienes esta caja en tu inventario.',
          ephemeral: true,
        });
      }

      // Verificar si el usuario tiene al menos una caja
      if (inventory.packs[item] <= 0) {
        return interaction.reply({
          content: `No tienes la caja **${packInfo.name}** en tu inventario o ya la usaste.`,
          ephemeral: true,
        });
      }

      // Restar 1 de la caja
      inventory.packs[item] -= 1;

      // Eliminar la caja si se queda en 0
      if (inventory.packs[item] === 0) {
        delete inventory.packs[item];
      }

      await inventory.save();

      // Obtener cartas basadas en la rareza del pack
      const selectedCards = await Card.find({
        rarity: { $in: packInfo.rarity },
        event: { $in: [null, false] } // Excluir cartas de eventos
      });

      if (selectedCards.length === 0) {
        return interaction.reply({
          content: 'No se encontraron cartas disponibles para esta caja.',
          ephemeral: true,
        });
      }

      // Seleccionar la cantidad de cartas según `packInfo.cardCount`
      const packCards = [];
      for (let i = 0; i < packInfo.cardCount; i++) {
        const randomIndex = Math.floor(Math.random() * selectedCards.length);
        packCards.push(selectedCards[randomIndex]);
      }

      // Crear embed
      const embed = new EmbedBuilder()
        .setAuthor({ name: `¡Has abierto una caja!`, iconURL: interaction.user.displayAvatarURL() })
        .setColor('#f79862')
        .setThumbnail(packInfo.url);

      for (const card of packCards) {
        const uniqueCode = generateCardCode(card.idol, card.grupo, card.era, String(card.rarity), card.event);
        const { copyNumber } = await incrementCardCount(userId, card._id);

        if (copyNumber <= 0) {
          throw new Error('Error al incrementar el contador de la carta.');
        }

        await new DroppedCard({
          userId,
          cardId: card._id,
          idol: card.idol,
          grupo: card.grupo,
          era: card.era,
          eshort: card.eshort,
          rarity: card.rarity,
          event: card.event,
          uniqueCode,
          command: '/use',
          copyNumber,
        }).save();

        const emoji = rarityToEmojis(card.rarity);
        embed.addFields({
          name: `${card.idol} <:dot:1288002853436260394> \`#${copyNumber}\``,
          value: `${emoji} ${card.grupo} ${card.eshort}\n\`\`\`${uniqueCode}\`\`\``,
          inline: true,
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error(error);

      // Revertir el uso de la caja si hubo un error
      const inventory = await Inventory.findOne({ userId });
      if (inventory) {
        inventory.packs[item] = (inventory.packs[item] || 0) + 1;
        await inventory.save();
      }

      return interaction.reply({
        content: 'Hubo un error al usar la caja. Inténtalo nuevamente.',
        ephemeral: true,
      });
    }
  },
};
