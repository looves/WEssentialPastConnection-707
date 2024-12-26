const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const DroppedCard = require('../models/DroppedCard');
const getImageExtension = require('../utils/getImageExtension');
const axios = require('axios');
const sharp = require('sharp');

// Función para descargar y redimensionar imágenes sin duplicados (sin CopyNumber)
async function fetchImages(cardUrls, copyNumbers) {
  const cardWidth = 1184;  // Ancho fijo para redimensionar
  const cardHeight = 1669; // Alto fijo para redimensionar

  // Lista para almacenar los buffers de imagen
  const imageBuffers = [];
  // Objeto para almacenar la URL de cada carta con su código único (sin CopyNumber)
  const urlCache = {};

  // Recorremos las URLs de las cartas
  for (let i = 0; i < cardUrls.length; i++) {
    const url = cardUrls[i];
    const copyNumber = copyNumbers[i];  // Obtenemos el número de copia

    // Crear una clave única para la combinación de URL y copyNumber
    const cacheKey = `${url}_${copyNumber}`;

    if (!urlCache[cacheKey]) {
      // Si la URL y copyNumber no están en el cache, la descargamos y procesamos
      const response = await axios.get(url, { responseType: 'arraybuffer' });

      // Redimensionar la imagen (sin agregar el texto de CopyNumber)
      const imageBuffer = await sharp(response.data)
        .resize(cardWidth, cardHeight) // Redimensionamos la imagen
        .toBuffer();  // No agregamos ningún texto

      // Guardamos el buffer de la imagen y la URL + copyNumber en el cache
      urlCache[cacheKey] = imageBuffer;
    }
    imageBuffers.push(urlCache[cacheKey]);  // Añadimos el buffer (ya sea nuevo o reutilizado)
  }

  return imageBuffers;
}

// Función para combinar las imágenes en una cuadrícula de 3x3
async function combineCardImages(cardUrls, copyNumbers) {
  try {
    const cardCount = cardUrls.length;
    if (cardCount === 0) {
      throw new Error('No hay imágenes para combinar.');
    }

    const rows = Math.ceil(cardCount / 3);  // 3 filas máximo
    const cols = Math.min(cardCount, 3);   // 3 columnas máximo

    const cardWidth = 1184;
    const cardHeight = 1669;

    // Descargar y redimensionar las imágenes sin duplicados y con el texto de copyNumber
    const imageBuffers = await fetchImages(cardUrls, copyNumbers);

    // Crear la imagen combinada con el tamaño adecuado
    const combinedImage = sharp({
      create: {
        width: cardWidth * cols,  // 3 cartas por columna (máximo)
        height: cardHeight * rows,  // Número de filas * altura de una carta
        channels: 4,  // 4 canales: RGBA
        background: { r: 255, g: 255, b: 255, alpha: 0 }  // Fondo transparente
      }
    })
      .composite(imageBuffers.map((buffer, index) => {
        const row = Math.floor(index / cols);  // Calcular la fila
        const col = index % cols;  // Calcular la columna
        return {
          input: buffer,
          top: row * cardHeight,  // Posición vertical (fila)
          left: col * cardWidth   // Posición horizontal (columna)
        };
      }))
      .png();  // Guardar como PNG

    // Devolver el buffer de la imagen combinada
    return await combinedImage.toBuffer();
  } catch (error) {
    console.error('Error al combinar las imágenes:', error);
    throw new Error('No se pudo combinar las imágenes.');
  }
}

// Función para generar el código de la imagen basado en las iniciales
function cardCodeImg(idol, grupo, era, rarity) {
  return `${idol[0].toUpperCase()}${grupo[0].toUpperCase()}${era[0].toUpperCase()}${rarity}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription('Muestra la información de las cartas usando sus códigos únicos')
    .addStringOption(option =>
      option.setName('codes')
        .setDescription('Códigos únicos de las cartas, separados por espacio')
        .setRequired(true))
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

  async execute(interaction) {
    // Obtener y procesar los códigos (eliminar espacios adicionales)
    const uniqueCodes = interaction.options.getString('codes')
      .trim()  // Elimina los espacios al principio y al final
      .split(/\s+/);  // Divide la cadena usando cualquier cantidad de espacios

    try {
      // Diferir la respuesta para dar más tiempo
      await interaction.deferReply({ ephemeral: false }); // Asegúrate de permitir una respuesta tardía

      // Buscar las cartas usando los códigos únicos proporcionados
      const droppedCards = await Promise.all(uniqueCodes.map(code => 
        DroppedCard.findOne({ uniqueCode: code }).populate('cardId')
      ));

      // Verificar si todas las cartas fueron encontradas
      const missingCards = uniqueCodes.filter((code, index) => !droppedCards[index]);

      if (missingCards.length > 0) {
        return interaction.editReply({
          content: `No se encontraron cartas con los siguientes códigos: ${missingCards.join(', ')}`,
          ephemeral: true
        });
      }

      // Obtener el propietario de la carta
      const owner = await interaction.client.users.fetch(droppedCards[0].userId);

      // Si solo se quiere ver una carta, devolver solo el enlace (como imagen incrustada)
      if (droppedCards.length === 1) {
        const card = droppedCards[0].cardId;
        const cardCode = cardCodeImg(card.idol, card.grupo, card.era, card.rarity); 
        const cardUrl = card.image;  
        const extension = getImageExtension(cardUrl);
        const fileCard = `${cardCode}${extension}`; 

        // Crear un Embed con la información de la carta
        const embed = new EmbedBuilder()
          .setColor('#60a5fa')
          .setFooter({ text: `Looking at ${owner.username}'s card`, iconURL: owner.displayAvatarURL() })
          .setTitle('Card details')
          .setDescription(`${card.idol} de **${card.grupo}** ${card.eshort} <:dot:1291582825232994305>\`#${droppedCards[0].copyNumber}\`\n\`\`\`${droppedCards[0].uniqueCode}\`\`\``);

        // Enviar el embed con la imagen mostrada directamente
        await interaction.editReply({
          embeds: [embed],
          files: [{
            attachment: cardUrl, 
            name: fileCard
          }]
        });

        return;
      }

      // Si se proporcionan más de una carta, las combinamos
      const cardUrls = droppedCards.map(droppedCard => droppedCard.cardId.image);
      const copyNumbers = droppedCards.map(droppedCard => droppedCard.copyNumber);

      // Combinar las imágenes de las cartas en una cuadrícula 3x3
      const combinedImageBuffer = await combineCardImages(cardUrls, copyNumbers);

      // Enviar solo la imagen combinada sin embed
      await interaction.editReply({
        files: [{
          attachment: combinedImageBuffer, // Enviar el buffer de la imagen combinada
          name: 'wonhocards.png'
        }]
      });

    } catch (error) {
      console.error('Error al ejecutar el comando view:', error);
      await interaction.editReply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  }
};
