const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DroppedCard = require('../models/DroppedCard');
const Card = require('../models/Card');
const User = require('../models/User');
const rarityToEmojis = require('../utils/rarityToEmojis');
const transactionGuard = require('../utils/transactionGuard');  // Importar el utils de transacciones

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Permite transferir cartas o dinero a otro usuario.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('El usuario al que deseas transferir.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('card')
        .setDescription('El código de la carta que deseas transferir.')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('coins')
        .setDescription('La cantidad de dinero que deseas transferir.')
        .setRequired(false)),

  async execute(interaction) {
    const usuario = interaction.options.getUser('user');
    const codigo = interaction.options.getString('card');
    const dinero = interaction.options.getInteger('coins');
    const usuarioIniciador = interaction.user;

    if (usuario.id === usuarioIniciador.id) {
      return interaction.reply({ content: 'No puedes transferir cartas o dinero a ti mismo.', ephemeral: true });
    }

    try {
      const sender = await User.findOne({ userId: usuarioIniciador.id });
      const recipient = await User.findOne({ userId: usuario.id });

      if (!sender) {
        return interaction.reply({ content: 'No se encontró tu perfil en la base de datos. Por favor, configura tu perfil primero.', ephemeral: true });
      }

      if (!recipient) {
        return interaction.reply({ content: 'El usuario al que intentas transferir no tiene un perfil en el sistema.', ephemeral: true });
      }

      // Verificar y procesar la transferencia de dinero
      if (dinero) {
        if (sender.coins < dinero) {
          return interaction.reply({ content: 'No tienes suficiente dinero para realizar esta transferencia.', ephemeral: true });
        }

        const embedDinero = new EmbedBuilder()
          .setTitle('Transferencia de Dinero')
          .setColor('#60a5fa')
          .setDescription(`<:dot:1291582825232994305>Estás a punto de transferir ${dinero} :coin: coins a ${usuario.username}.`);

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('accept_transfer_money')
              .setLabel('Aceptar')
              .setEmoji("<:check:1298398838570356767>")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cancel_transfer_money')
              .setLabel('Rechazar')
              .setEmoji("<:close:1290467856437481574>")
              .setStyle(ButtonStyle.Danger)
          );

        await interaction.reply({ embeds: [embedDinero], components: [row] });

        const filter = i => (i.customId === 'accept_transfer_money' || i.customId === 'cancel_transfer_money') && i.user.id === usuarioIniciador.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
          if (i.customId === 'accept_transfer_money') {
            await transactionGuard(
              async () => {
                sender.coins -= dinero;
                recipient.coins = (recipient.coins || 0) + dinero;
                await sender.save();
                await recipient.save();

                await interaction.editReply({ content: `_ _¡Transferencia de dinero completada con éxito!_ _||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​|||||||||||| ${usuario}`, embeds: [], components: [] });
              },
              async () => {
                sender.coins += dinero;
                await sender.save();
              },
              interaction
            );
            collector.stop();
          } else if (i.customId === 'cancel_transfer_money') {
            await interaction.editReply({ content: 'La transferencia de dinero ha sido cancelada.', embeds: [], components: [] });
            collector.stop();
          }
        });

        collector.on('end', collected => {
          if (!collected.size) {
            interaction.editReply({ content: 'El tiempo para aceptar la transferencia de dinero ha expirado.', embeds: [], components: [] });
          }
        });

        return;
      }

      // Verificar y procesar la transferencia de carta
      if (codigo) {
        const cartaDroppada = await DroppedCard.findOne({ userId: usuarioIniciador.id, uniqueCode: codigo }).populate('cardId');

        if (!cartaDroppada) {
          return interaction.reply({ content: 'No posees la carta que intentas transferir.', ephemeral: true });
        }

        const cartaOriginal = cartaDroppada.cardId;

        if (!cartaOriginal) {
          return interaction.reply({ content: 'No se pudo encontrar la información de la carta en la base de datos.', ephemeral: true });
        }

        const embedCarta = new EmbedBuilder()
          .setTitle('Transferencia de Carta')
          .setColor('#60a5fa')
          .setDescription(`Estás a punto de transferir a __**${usuario.username}**__ la carta:`)
          .addFields({ name: `${cartaOriginal.idol}<:dot:1291582825232994305>\`#${cartaDroppada.copyNumber}\``, value: `${rarityToEmojis(cartaDroppada.rarity)} ${cartaOriginal.grupo} ${cartaOriginal.eshort}\n\`\`\`${cartaDroppada.uniqueCode}\`\`\`` });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('accept_transfer_card')
            .setEmoji("<:check:1298398838570356767>")
              .setLabel('Aceptar')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cancel_transfer_card')
              .setEmoji("<:close:1290467856437481574>")
              .setLabel('Rechazar')
              .setStyle(ButtonStyle.Danger)
          );

        await interaction.reply({ embeds: [embedCarta], components: [row] });

        const filter = i => (i.customId === 'accept_transfer_card' || i.customId === 'cancel_transfer_card') && i.user.id === usuarioIniciador.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
          if (i.customId === 'accept_transfer_card') {
            await transactionGuard(
              async () => {
                cartaDroppada.userId = usuario.id;
                await cartaDroppada.save();

                const embedTransferida = new EmbedBuilder()
                  .setTitle('Transferencia exitosa!')
                  .setColor('#60a5fa')
                  .setDescription(`\`${cartaOriginal.idol}\` de **${cartaOriginal.grupo}** ${cartaOriginal.eshort} <:dot:1291582825232994305>\`#${cartaDroppada.copyNumber}\`\n\`\`\`${cartaDroppada.uniqueCode}\`\`\``)
                  .setImage(cartaOriginal.image);

                await interaction.editReply({ content: `Carta transferida a ${usuario}`, embeds: [embedTransferida], components: [] });
              },
              async () => {
                cartaDroppada.userId = usuarioIniciador.id;
                await cartaDroppada.save();
              },
              interaction
            );
            collector.stop();
          } else if (i.customId === 'cancel_transfer_card') {
            await interaction.editReply({ content: 'La transferencia de la carta ha sido cancelada.', embeds: [], components: [] });
            collector.stop();
          }
        });

        collector.on('end', collected => {
          if (!collected.size) {
            interaction.editReply({ content: 'El tiempo para aceptar la transferencia de la carta ha expirado.', embeds: [], components: [] });
          }
        });
      }

    } catch (error) {
      console.error('Error en la ejecución del comando /transfer:', error);
      interaction.reply({ content: 'Ocurrió un error al intentar transferir. Inténtalo de nuevo más tarde.', ephemeral: true });
    }
  }
};
