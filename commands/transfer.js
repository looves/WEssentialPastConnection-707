const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DroppedCard = require('../models/DroppedCard');
const rarityToEmojis = require('../utils/rarityToEmojis');
const User = require('../models/User');
const axios = require('axios');
const sharp = require('sharp');

// Función para descargar y redimensionar imágenes sin texto de CopyNumber
async function fetchImagesWithoutCopyNumber(cardData) {
  const cardWidth = 1080; // Ancho fijo
  const cardHeight = 1669; // Alto fijo

  const imageBuffers = [];
  const urlCache = new Set(); // Usamos un Set para evitar duplicados

  for (const { url } of cardData) {
    const uniqueKey = `${url}`;
    if (!urlCache.has(uniqueKey)) {
      const response = await axios.get(url, { responseType: 'arraybuffer' });

      // Redimensionar la imagen sin agregar el texto de CopyNumber
      const imageBuffer = await sharp(response.data)
        .resize(cardWidth, cardHeight)
        .toBuffer();  // Solo redimensionamos la imagen, sin texto

      urlCache.add(uniqueKey);
      imageBuffers.push(imageBuffer);
    }
  }

  return imageBuffers;
}

// Función para combinar imágenes en una cuadrícula 3x3 (sin CopyNumber)
async function combineCardImagesWithoutCopyNumber(cardData) {
  try {
    const cardCount = cardData.length;
    if (cardCount === 0) throw new Error('No hay imágenes para combinar.');

    const rows = Math.ceil(cardCount / 3);
    const cols = Math.min(cardCount, 3);

    const cardWidth = 1080;
    const cardHeight = 1669;

    const imageBuffers = await fetchImagesWithoutCopyNumber(cardData);

    const combinedImage = sharp({
      create: {
        width: cardWidth * cols,
        height: cardHeight * rows,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite(imageBuffers.map((buffer, index) => ({
        input: buffer,
        top: Math.floor(index / cols) * cardHeight,
        left: (index % cols) * cardWidth,
      })))
      .png();

    return await combinedImage.toBuffer();
  } catch (error) {
    console.error('Error al combinar las imágenes:', error);
    throw new Error('No se pudo combinar las imágenes.');
  }
}


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
        .setDescription('Los códigos de las cartas que deseas transferir (separados por espacios).')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('coins')
        .setDescription('La cantidad de dinero que deseas transferir.')
        .setRequired(false)),

  async execute(interaction) {
    const usuario = interaction.options.getUser('user');
    const codigos = interaction.options.getString('card');
    const dinero = interaction.options.getInteger('coins');
    const usuarioIniciador = interaction.user;

    // Responde de forma diferida para que no haya timeout
    await interaction.deferReply();

try {
  const sender = await User.findOne({ userId: usuarioIniciador.id });
  const recipient = await User.findOne({ userId: usuario.id });

  if (!sender || !recipient) {
    return interaction.editReply({ content: 'Uno de los usuarios no tiene un perfil registrado.', ephemeral: true });
  }

  // Transferencia de dinero
  if (dinero) {
    if (sender.coins < dinero) {
      return interaction.editReply({ content: 'No tienes suficientes monedas para realizar esta transferencia.', ephemeral: true });
    }

    const embedDinero = new EmbedBuilder()
      .setTitle('Transferencia de Monedas')
      .setColor('#60a5fa')
      .setDescription(`<:dot:1291582825232994305> Estás a punto de transferir **${dinero}** coins a **${usuario.username}**.`);

    const rowDinero = new ActionRowBuilder()
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

    // Mostrar el embed con los botones
    await interaction.editReply({ embeds: [embedDinero], components: [rowDinero] });

    const filter = i => i.user.id === usuarioIniciador.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'accept_transfer_money') {
        // Procesar la transferencia
        sender.coins -= dinero;
        recipient.coins = (recipient.coins || 0) + dinero;

        await sender.save();
        await recipient.save();

        // Responder con un mensaje de éxito y eliminar el embed y los botones
        await interaction.editReply({
          content: `_ _¡Transferencia de **${dinero}** monedas completada!_ _`,
          embeds: [], // Eliminar el embed
          components: [] // Eliminar los botones
        });
      } else if (i.customId === 'cancel_transfer_money') {
        // Cancelar la transferencia y eliminar el embed y los botones
        await interaction.editReply({
          content: 'Transferencia de monedas cancelada.',
          embeds: [], // Eliminar el embed
          components: [] // Eliminar los botones
        });
      }
      collector.stop(); // Detener el colector
    });

        collector.on('end', collected => {
          if (!collected.size) {
            interaction.editReply({ content: 'El tiempo para aceptar la transferencia de monedas expiró.', embeds: [], components: [] });
          }
        });
      }

      // Transferencia de cartas
      if (codigos) {
        const codigosArray = codigos.split(/\s+/).filter(codigo => codigo.trim() !== '');

        if (codigosArray.length > 3) {
          return interaction.editReply({ content: 'Solo puedes transferir hasta 3 cartas a la vez.', ephemeral: true });
        }

        const cartasDroppadas = await DroppedCard.find({ userId: usuarioIniciador.id, uniqueCode: { $in: codigosArray } })
          .populate('cardId');

        const cartasNoEncontradas = codigosArray.filter(codigo => !cartasDroppadas.some(carta => carta.uniqueCode === codigo));
        if (cartasNoEncontradas.length > 0) {
          return interaction.editReply({ content: `No se encontraron cartas con los códigos: ${cartasNoEncontradas.join(' ')}.`, ephemeral: true });
        }

        const cardData = cartasDroppadas.map(carta => ({
          url: carta.cardId.image,
          copyNumber: carta.copyNumber,
        }));

        const embedCartas = new EmbedBuilder()
          .setTitle('Transferencia de Cartas')
          .setColor('#60a5fa')
          .setDescription(`Estás a punto de transferir a **${usuario.username}**:`);

        cartasDroppadas.forEach(carta => {
          const card = carta.cardId;
          embedCartas.addFields({
            name: `${card.idol}<:dot:1291582825232994305> \`#${carta.copyNumber}\``,
            value: `${rarityToEmojis(carta.rarity)} ${card.grupo} ${card.eshort}\n\`\`\`${carta.uniqueCode}\`\`\``
          });
        });

        const combinedImageBuffer = await combineCardImagesWithoutCopyNumber(cardData);

        const rowCartas = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('accept_transfer_cards')
              .setLabel('Aceptar')
              .setEmoji("<:check:1298398838570356767>")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cancel_transfer_cards')
              .setLabel('Rechazar')
              .setEmoji("<:close:1290467856437481574>")
              .setStyle(ButtonStyle.Danger)
          );

        await interaction.editReply({
          embeds: [embedCartas],
          components: [rowCartas]
        });

        const filterCartas = i => i.user.id === usuarioIniciador.id;
        const collectorCartas = interaction.channel.createMessageComponentCollector({ filter: filterCartas, time: 60000 });

        collectorCartas.on('collect', async i => {
          if (i.customId === 'accept_transfer_cards') {
            for (const carta of cartasDroppadas) {
              carta.userId = usuario.id;
              await carta.save();
            }

            // Embed de confirmación de transferencia exitosa
            const embedTransferida = new EmbedBuilder()
              .setTitle('Transferencia Exitosa!')
              .setColor('#60a5fa')
              .setDescription(`Las siguientes cartas han sido transferidas a **${usuario.username}**:`);
            embedTransferida.setImage('attachment://transfer_cards.png');

            // Editar la respuesta con el embed y la imagen dentro
            await interaction.editReply({
              content: `Carta transferida a ${usuario}`,
              embeds: [embedTransferida],
              components: [],
              files: [{ attachment: combinedImageBuffer, name: 'transfer_cards.png' }]
            });
          } else if (i.customId === 'cancel_transfer_cards') {
            await interaction.editReply({ content: 'Transferencia de cartas cancelada.', embeds: [], components: [] });
          }
          collectorCartas.stop();
        });

        collectorCartas.on('end', collected => {
          if (!collected.size) {
            interaction.editReply({ content: 'El tiempo para aceptar la transferencia de cartas expiró.', embeds: [], components: [] });
          }
        });
      }

    } catch (error) {
      console.error(error);
      interaction.editReply({ content: 'Hubo un error al procesar la transferencia.', ephemeral: true });
    }
  },
};
