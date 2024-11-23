const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DroppedCard = require('../models/DroppedCard');
const rarityToEmojis = require('../utils/rarityToEmojis');
const checkBan = require('../utils/checkBan');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Permite a dos usuarios intercambiar cartas.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('El usuario con el que deseas intercambiar cartas.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('offer')
        .setDescription('Los códigos de las cartas que estás ofreciendo, separados por espacios.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('request')
        .setDescription('Los códigos de las cartas que deseas recibir, separados por espacios.')
        .setRequired(true))
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),
    
  async execute(interaction) {
    const usuario = interaction.options.getUser('user');
    const ofertaCodes = interaction.options.getString('offer').split(' ').map(code => code.trim());
    const pedirCodes = interaction.options.getString('request').split(' ').map(code => code.trim());
    const usuarioIniciador = interaction.user;

    // Verificar si el usuario que inicia el intercambio está baneado
    if (await checkBan(usuarioIniciador.id)) {
      return interaction.reply({ content: `No puedes usar \`/trade\` porque estás baneado.\n-# Si crees que estás baneado por error, abre ticket en Wonho's House <#1248108503973757019>.`, ephemeral: true });
    }

    // Verificar si el usuario receptor está baneado
    if (await checkBan(usuario.id)) {
      return interaction.reply({ content: `El usuario **${usuario.username}** está baneado y no puede participar en trades.`, ephemeral: true });
    }
    
    if (usuario.id === usuarioIniciador.id) {
      return interaction.reply({ content: 'No puedes intercambiar cartas contigo mismo.', ephemeral: true });
    }

    // Limitar el número de cartas ofrecidas y solicitadas a 4
    if (ofertaCodes.length > 4 || pedirCodes.length > 4) {
      return interaction.reply({ content: 'Puedes intercambiar hasta 4 cartas a la vez.', ephemeral: true });
    }

    try {
      const cartasOfrecidas = await DroppedCard.find({ userId: usuarioIniciador.id, uniqueCode: { $in: ofertaCodes } });
      const cartasPedidas = await DroppedCard.find({ userId: usuario.id, uniqueCode: { $in: pedirCodes } });

      // Verificación de cartas ofrecidas
      const cartasOfrecidasFaltantes = ofertaCodes.filter(code => !cartasOfrecidas.some(card => card.uniqueCode === code));
      const cartasPedidasFaltantes = pedirCodes.filter(code => !cartasPedidas.some(card => card.uniqueCode === code));

      if (cartasOfrecidasFaltantes.length > 0) {
        return interaction.reply({ content: `No posees las siguientes cartas para ofrecer: ${cartasOfrecidasFaltantes.join(', ')}`, ephemeral: true });
      }
      if (cartasPedidasFaltantes.length > 0) {
        return interaction.reply({ content: `${usuario.username} no posee las siguientes cartas que solicitas: ${cartasPedidasFaltantes.join(', ')}`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setAuthor({ name: `Intercambio de cartas:`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(`__**${usuarioIniciador.username}**__ quiere intercambiar cartas con __**${usuario.username}**__`);

      // Agregar campos para las cartas ofrecidas
      embed.addFields({ name: 'offer:', value: cartasOfrecidas.map(card => `**${card.idol}**<:dot:1296707029087555604>\`#${card.copyNumber}\`\n${rarityToEmojis(card.rarity)} ${card.grupo} ${card.eshort}\n\`\`\`${card.uniqueCode}\`\`\``).join('\n'), inline: true });

      // Agregar campos para las cartas solicitadas
      embed.addFields({ name: 'request:', value: cartasPedidas.map(card => `**${card.idol}**<:dot:1296707029087555604>\`#${card.copyNumber}\`\n${rarityToEmojis(card.rarity)} ${card.grupo} ${card.eshort}\n\`\`\`${card.uniqueCode}\`\`\``).join('\n'), inline: true });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('accept_trade')
            .setEmoji("<:check:1298398838570356767>")
            .setLabel('Aceptar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('cancel_trade')
            .setEmoji("<:close:1290467856437481574>")
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.reply({ content: `${usuario}, tienes que aceptar o rechazar el intercambio.`, embeds: [embed], components: [row] });

      const filter = i => (i.customId === 'accept_trade' || i.customId === 'cancel_trade') && i.user.id === usuario.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'accept_trade') {
          try {
            for (const card of cartasOfrecidas) {
              card.userId = usuario.id;
              await card.save();
            }
            for (const card of cartasPedidas) {
              card.userId = usuarioIniciador.id;
              await card.save();
            }

            await interaction.editReply({ content: '¡Intercambio completado con éxito!', embeds: [], components: [] });
            collector.stop();
          } catch (error) {
            console.error('Error al realizar el intercambio:', error);
            await interaction.editReply({ content: 'Hubo un error al intentar realizar el intercambio. Por favor, inténtalo de nuevo.', embeds: [], components: [] });
            collector.stop();
          }
        } else if (i.customId === 'cancel_trade') {
          await interaction.editReply({ content: 'El intercambio ha sido cancelado.', embeds: [], components: [] });
          collector.stop();
        }
      });

      collector.on('end', collected => {
        if (!collected.size) {
          interaction.editReply({ content: 'El tiempo para aceptar el intercambio ha expirado.', embeds: [], components: [] });
        }
      });
    } catch (error) {
      console.error('Error al ejecutar el comando /trade:', error);
      await interaction.reply('Hubo un error al procesar el intercambio. Por favor, inténtalo de nuevo.');
    }
  },
};
