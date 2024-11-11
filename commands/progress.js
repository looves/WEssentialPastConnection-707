const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');
const axios = require('axios');

const TENOR_API_KEY = 'AIzaSyBo2lclJkMtImQhgXtuNshTIWZVVGY7hrE'; // Reemplaza esto con tu API key de Tenor
const TENOR_API_URL = 'https://tenor.googleapis.com/v2/search';

let usedGifs = []; // Lista para almacenar GIFs ya utilizados

async function fetchRandomGif(query) {
  try {
    const response = await axios.get(TENOR_API_URL, {
      params: {
        q: query,
        key: TENOR_API_KEY,
        client_key: 'my_test_app',
        limit: 50, // Obtener hasta 50 GIFs para seleccionar
      },
    });

    // Filtrar los GIFs que no han sido utilizados
    const availableGifs = response.data.results.filter(gif => !usedGifs.includes(gif.id));

    // Si no hay GIFs disponibles, reiniciar la lista de utilizados
    if (availableGifs.length === 0) {
      usedGifs = [];
      return fetchRandomGif(query); // Volver a intentar la búsqueda
    }

    // Seleccionar un GIF aleatorio de los disponibles
    const randomGif = availableGifs[Math.floor(Math.random() * availableGifs.length)];

    // Añadir el ID del GIF a la lista de utilizados
    usedGifs.push(randomGif.id);

    return randomGif.media_formats.gif.url; // Retorna la URL del GIF
  } catch (error) {
    console.error('Error al obtener GIF de Tenor:', error);
    return null; // Retorna null en caso de error
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('progress')
    .setDescription('Muestra tu progreso en completar cartas.')
    .addStringOption(option =>
      option.setName('grupo')
        .setDescription('Nombre del grupo')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('idol')
        .setDescription('Nombre del idol')
        .setRequired(false)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const grupo = interaction.options.getString('grupo');
    const idol = interaction.options.getString('idol');

    try {
      await interaction.deferReply();
    } catch (error) {
      console.error('Error al deferir la respuesta:', error);
      return; // Termina la ejecución si no puede deferir la respuesta
    }

    try {
      // Validar que al menos haya proporcionado grupo o idol
      if (!grupo && !idol) {
        return interaction.editReply({ content: 'Debes proporcionar al menos un grupo o un idol.', ephemeral: true });
      }

      // Crear consulta para obtener cartas según el grupo o idol
      let query = {};
      if (idol) {
        query.idol = { $regex: new RegExp(idol, 'i') }; // Si se proporciona idol, buscamos por idol
      }
      if (grupo) {
        query.grupo = { $regex: new RegExp(grupo, 'i') }; // Si se proporciona grupo, buscamos por grupo
      }

      // Obtener todas las cartas disponibles que coinciden con el grupo o idol
      const allCards = await Card.find(query);
      if (allCards.length === 0) {
        return interaction.editReply({ content: 'No se encontraron cartas con los criterios proporcionados.', ephemeral: true });
      }

      // Obtener todas las cartas dropeadas por el usuario
      const userDroppedCards = await DroppedCard.find({ userId }).populate('cardId');

      // Filtrar las cartas del usuario que coinciden con el grupo o idol
      const userOwnedCards = userDroppedCards.filter(droppedCard => 
        droppedCard.cardId && allCards.some(card => card._id.equals(droppedCard.cardId._id))
      );

      // Crear un objeto para contar solo una vez por combinación de idol, grupo, era y rareza
      const uniqueCards = {};

      userOwnedCards.forEach(droppedCard => {
        const { idol, grupo, era, rarity } = droppedCard.cardId;
        const key = `${idol}:${grupo}:${era}:${rarity}`; // Generamos una clave única por combinación

        if (!uniqueCards[key]) {
          uniqueCards[key] = true; // Si no existe, la contamos una sola vez
        }
      });

      const totalCards = allCards.length; // Total de cartas disponibles del grupo o idol
      const ownedCards = Object.keys(uniqueCards).length; // Cartas obtenidas (solo contando una vez por combinación única)
      const missingCards = totalCards - ownedCards; // Cartas que faltan
      const progressPercentage = ((ownedCards / totalCards) * 100).toFixed(2); // Progreso en porcentaje

      // Determinar qué búsqueda usar para el GIF
      const searchQuery = idol ? idol : grupo; // Usar idol si se proporciona, si no, usar grupo
      const gifUrl = await fetchRandomGif(searchQuery); // Buscar GIF usando el nombre

      // Crear el embed de progreso sin las rarezas
      const progressEmbed = new EmbedBuilder()
        .setTitle(`Progreso de ${grupo.toUpperCase()}${idol ? ' - ' + idol.toUpperCase() : ''}`)
        .setDescription(`Has completado el **${progressPercentage}%** de las cartas de ${idol || grupo}.`)
        .addFields(
          { name: 'Cartas obtenidas:', value: `${ownedCards}/${totalCards}`, inline: true },
          { name: 'Cartas faltantes:', value: `${missingCards}`, inline: true }
        )
        .setColor('#60a5fa');

      if (progressPercentage === '100.00') {
        progressEmbed.setFooter({ text: '¡Felicidades! Has completado todas las cartas.' });
      }

      // Añadir el GIF al embed si existe
      if (gifUrl) {
        progressEmbed.setImage(gifUrl);
      }

      return interaction.editReply({ embeds: [progressEmbed] });
    } catch (error) {
      console.error('Error al obtener el progreso:', error);
      return interaction.editReply({ content: 'Hubo un error al obtener tu progreso. Inténtalo de nuevo más tarde.', ephemeral: true });
    }
  },
};
