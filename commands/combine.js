const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const DroppedCard = require('../models/DroppedCard');
const Card = require('../models/Card');
const Inventory = require('../models/Inventory');
const generateCardCode = require('../utils/generateCardCode');
const getImageExtension = require('../utils/getImageExtension');
const incrementCardCount = require('../utils/incrementCardCount'); // Util para incrementar copias
const rarityToEmojis = require('../utils/rarityToEmojis'); // Para obtener los emojis de rareza

// Definir el ID del bot
const BOT_ID = '1273625876961165402';
const FIELDS_PER_PAGE = 4;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('combine')
    .setDescription('Comando para combinar cartas.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('check')
        .setDescription('Revisa las cartas que puedes combinar (máximo 10).'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('cards')
        .setDescription('Combinación de carta.')
        .addStringOption(option =>
          option.setName('codes')
            .setDescription('Códigos de las cartas que quieres combinar (máximo 10).')
            .setRequired(true)
            .setAutocomplete(false)
        )),

  async execute(interaction) {

    const userId = interaction.user.id;

    if (interaction.options.getSubcommand() === 'check') {
      try {
        // Obtener todas las cartas del usuario con rarity '1' y '2'
        const cards = await DroppedCard.find({
          userId: userId,
          rarity: { $in: ['1', '2'] } // Filtra por rarity '1' o '2'
        }).populate('cardId');

        // Contar cuántas cartas de cada idol tiene el usuario, separadas por rarity
        const idolCards = {};

        cards.forEach(droppedCard => {
          const card = droppedCard.cardId;
          const idol = card.idol;
          const rarity = droppedCard.rarity;  // Aquí rarity es un string, '1' o '2'

          if (!idolCards[idol]) {
            idolCards[idol] = { '1': 0, '2': 0 };  // Usamos '1' y '2' como claves
          }

          if (rarity === '1') {
            idolCards[idol]['1']++;
          } else if (rarity === '2') {
            idolCards[idol]['2']++;
          }
        });

        // Filtrar y mostrar sólo los idols que tienen más de 10 cartas de rarity '1' o '2'
        const idolsToCombine = Object.keys(idolCards).filter(idol => {
          return idolCards[idol]['1'] >= 10 || idolCards[idol]['2'] >= 10;
        });

        if (idolsToCombine.length === 0) {
          return interaction.reply({
            content: 'No puedes combinar, se necesitan al menos 10 cartas.',
            ephemeral: true
          });
        }

        // Dividir la lista de idolsToCombine en páginas
        const totalPages = Math.ceil(idolsToCombine.length / FIELDS_PER_PAGE);
        let currentPage = 0;  // Página actual

        const embed = new EmbedBuilder()
          .setColor('#60a5fa')
          .setTitle('Opciones disponibles para combinar:');

        // Función para actualizar el embed con la página correspondiente
        function generatePageEmbed(page) {
          embed.fields = [];  // Limpiar los campos de la página actual

          const start = page * FIELDS_PER_PAGE;
          const end = Math.min((page + 1) * FIELDS_PER_PAGE, idolsToCombine.length);

          for (let i = start; i < end; i++) {
            const idol = idolsToCombine[i];
            const rarity1Count = idolCards[idol]['1'];
            const rarity2Count = idolCards[idol]['2'];

            // Solo mostrar rarity 1 si tiene más de 10 cartas
            if (rarity1Count >= 10) {
              const rarity1Emoji = rarityToEmojis('1');
              const card = cards.find(card => card.cardId.idol === idol);  // Obtener el primer card con ese idol

              if (card) {
                embed.addFields(
                  { 
                    name: `<:dot:1291582825232994305> ${idol} ${card.cardId.grupo} ${card.cardId.era}\n        \`${rarity1Count}/10\` ${rarity1Emoji}`, 
                    value: `-# Puedes combinar **${rarity1Count}** cartas.`
                  }
                );
              }
            }

            // Solo mostrar rarity 2 si tiene más de 10 cartas
            if (rarity2Count >= 10) {
              const rarity2Emoji = rarityToEmojis('2');
              const card = cards.find(card => card.cardId.idol === idol);  // Obtener el primer card con ese idol

              if (card) {
                embed.addFields(
                  { 
                    name: `<:dot:1291582825232994305> ${idol} ${card.cardId.grupo} ${card.cardId.era}\n         \`${rarity2Count}/10\` ${rarity2Emoji}`, 
                    value: `-# Puedes combinar **${rarity2Count}** cartas.`
                  }
                );
              }
            }
          }

          // Añadir los botones para la paginación
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('previous')
                .setEmoji("<:prev:1290467827739787375>")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),  // Desactivar si es la primera página
              new ButtonBuilder()
                .setCustomId('next')
                .setEmoji("<:next:1290467800065769566>")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)  // Desactivar si es la última página
            );

          return { embed, row };
        }

        // Enviar la primera página
        const { embed: initialEmbed, row } = generatePageEmbed(0);
        const message = await interaction.reply({
          embeds: [initialEmbed],
          components: [row]
        });

        // Manejar la interacción con los botones de paginación
        const filter = i => i.user.id === userId;
        const collector = message.createMessageComponentCollector({
          filter,
          time: 60000
        });

        collector.on('collect', async i => {
          if (i.customId === 'next' && currentPage < totalPages - 1) {
            currentPage++;
          } else if (i.customId === 'previous' && currentPage > 0) {
            currentPage--;
          }

          // Actualizar el embed con la nueva página
          const { embed: pageEmbed, row: pageRow } = generatePageEmbed(currentPage);
          await i.update({
            embeds: [pageEmbed],
            components: [pageRow]
          });
        });

        collector.on('end', () => {
          // Desactivar botones después del tiempo de la colecta
          message.edit({
            embeds: [embed], 
            components: []
          });
        });
    
      } catch (error) {
        console.error('Error al ejecutar el comando /combine check:', error);
        await interaction.reply({ content: 'Ocurrió un error al procesar tu solicitud.', ephemeral: true });
      }

    } else if (interaction.options.getSubcommand() === 'cards') {
      const codes = interaction.options.getString('codes').split(' '); // Separar los códigos por espacios

      try {
        // Verificar que se proporcionen exactamente 10 cartas
        if (codes.length !== 10) {
          return interaction.reply({
            content: 'Debes proporcionar exactamente 10 cartas de rareza 1 o 2.',
            ephemeral: true
          });
        }

        const userId = interaction.user.id;
        
        // Obtener las cartas con los códigos proporcionados
        const cards = await DroppedCard.find({
          userId,
          uniqueCode: { $in: codes },
          rarity: { $in: ['1', '2'] } // Solo cartas rarity 1 o 2
        }).populate('cardId'); // Aseguramos que se haga populate de cardId

        if (cards.length !== 10) {
          return interaction.reply({
            content: 'No se encontraron todas las cartas o algunas no son de rareza 1 o 2.',
            ephemeral: true
          });
        }

        // Verificar que todas las cartas sean del mismo idol, era y rareza
        const firstCard = cards[0];
        const sameEra = cards.every(card => card.cardId.era === firstCard.cardId.era);
        const sameRarity = cards.every(card => card.rarity === firstCard.rarity);
        const sameIdol = cards.every(card => card.cardId.idol === firstCard.cardId.idol); // Verificar idol

        if (!sameEra || !sameRarity || !sameIdol) {
          return interaction.reply({
            content: 'Las cartas deben ser del mismo idol, era y rareza.',
            ephemeral: true
          });
        }

        // Eliminar las cartas del inventario del usuario
        await Inventory.updateOne(
          { userId },
          { $pull: { cards: { uniqueCode: { $in: codes } } } } // Eliminar cartas por código único
        );

        // Verificar si el bot tiene inventario; si no, crearlo
        const botInventory = await Inventory.findOneAndUpdate(
          { userId: BOT_ID },
          { $setOnInsert: { cards: [] } }, // Crear el inventario si no existe
          { upsert: true, new: true } // Crear y devolver el inventario actualizado
        );

        // Transferir las cartas al inventario del bot
        await Inventory.updateOne(
          { userId: BOT_ID },
          {
            $addToSet: {
              cards: {
                $each: cards.map(card => ({
                  uniqueCode: card.uniqueCode,
                  rarity: card.rarity
                }))
              }
            }
          }
        );

        // Actualizar las cartas en la colección DroppedCard
        const result = await DroppedCard.updateMany(
          { _id: { $in: cards.map(card => card._id) } },
          { $set: { userId: BOT_ID } } // Cambiar el userId al del bot
        );


        // Determinar la nueva rareza
        let newRarity;
        if (firstCard.rarity === '1') {
          newRarity = '2'; // Si las cartas son de rarity 1, la nueva será rarity 2
        } else if (firstCard.rarity === '2') {
          newRarity = '3'; // Si las cartas son de rarity 2, la nueva será rarity 3
        }

        // Buscar la carta base para la nueva rareza
        const card = await Card.findOne({
          idol: firstCard.cardId.idol,
          era: firstCard.cardId.era,
          grupo: firstCard.cardId.grupo,
          rarity: newRarity // Verificamos que la rareza sea la correcta
        });

        if (!card) {
          return interaction.reply({
            content: 'No se encontró una carta válida para la combinación.',
            ephemeral: true
          });
        }

        // Generar un nuevo código único para la carta combinada
        const uniqueCode = generateCardCode(card.idol, card.grupo, card.era, newRarity);

        // Usar el util para actualizar las copias de la carta existente sin duplicados
        const { copyNumber } = await incrementCardCount(userId, card._id);

        // Obtener la imagen de la carta combinada
        const imageUrl = card.image;
        const extension = getImageExtension(imageUrl);
        const attachment = new AttachmentBuilder(imageUrl, { name: `${uniqueCode}${extension}` });

        // Registrar la carta combinada en DroppedCard
        const droppedCard = new DroppedCard({
          userId,
          cardId: card._id,
          idol: card.idol,
          grupo: card.grupo,
          era: card.era,
          eshort: card.eshort,
          rarity: newRarity, // La nueva rareza
          uniqueCode,
          command: '/combine cards',
          copyNumber,
        });

        await droppedCard.save();

        // Crear el embed con la carta combinada
        const embed = new EmbedBuilder()
          .setColor('#60a5fa')
          .setDescription(`<@${interaction.user.id}>, has combinado la carta **${firstCard.cardId.idol}** de **${firstCard.cardId.grupo}** de la era **${firstCard.cardId.era}**.`)
          .addFields(
            { name: `${rarityToEmojis(newRarity)} <:dot:1291582825232994305> \`#${copyNumber}\``, value: `\`\`\`${uniqueCode}\`\`\`` }
          );

        await interaction.reply({
          embeds: [embed],
          files: [attachment]
        });
      } catch (error) {
        console.error('Error al combinar cartas:', error);
        await interaction.reply({ content: 'Ocurrió un error al procesar la combinación de cartas.', ephemeral: true });
      }
    }
  }
};
