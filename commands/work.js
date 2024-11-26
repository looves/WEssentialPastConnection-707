const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Gana monedas entre 25 y 65. Debes tener una carta favorita definida para usar este comando.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const currentTime = new Date().getTime();
    const cooldownTime = 4 * 60 * 1000; // 4 minutos en milisegundos

    try {
      // Busca la información del usuario en la base de datos
      const user = await User.findOne({ userId: userId });

      if (!user) {
        return interaction.reply({ content: 'No se encontró tu información. Por favor, configura tu perfil primero.', ephemeral: true });
      }

      // Verificar si el usuario está en cooldown
      if (user.lastWork) {
        const lastWorkTime = new Date(user.lastWork).getTime();
        const timeElapsed = currentTime - lastWorkTime;

        if (timeElapsed < cooldownTime) {
          const remainingTime = cooldownTime - timeElapsed;
          const minutes = Math.floor(remainingTime / 60000);
          const seconds = Math.floor((remainingTime % 60000) / 1000);
          return interaction.reply(`¡Debes esperar ${minutes} minutos y ${seconds} segundos antes de usar el comando </work:1291579000325406797> nuevamente!`);
        }
      }

      // Verifica si el usuario tiene una carta favorita definida
      if (!user.favoriteCard) {
        return interaction.reply({ content: `No puedes usar el comando </work:1291579000325406797> sin una carta favorita definida. Establece una carta favorita primero.`, ephemeral: true });
      }

      // Busca la carta favorita del usuario usando el valor de favoriteCard como una cadena
      const favoriteCard = await DroppedCard.findOne({ uniqueCode: user.favoriteCard });
      if (!favoriteCard) {
        return interaction.reply({ content: 'No se encontró tu carta favorita. Establece una carta favorita válida.', ephemeral: true });
      }

      // Genera un número aleatorio entre 25 y 65
      const min = 25;
      const max = 65;
      const earnedCoins = Math.floor(Math.random() * (max - min + 1)) + min;

      // Actualiza el saldo de monedas del usuario
      user.coins = (user.coins || 0) + earnedCoins;

      // Actualizar el último uso del comando /work
      user.lastWork = new Date();
      await user.save();

      // Mensajes aleatorios
      const workplaces = [
        'la oficina', 
        'un restaurante', 
        'un estudio de grabación', 
        'un parque', 
        'una tienda de cómics'];

      const tragedies = [
        'desafortunadamente, el jefe decidió cerrar la empresa',
        'fueron despedidos de manera inesperada',
        'su supervisor le dijo que no era lo suficientemente bueno',
        'tuvieron que salir corriendo al robar el puesto de helados',
        'y no pudo contener las lágrimas al enterarse del despido'
      ];

      // Elegir lugares y tragedias aleatoriamente
      const workplace = workplaces[Math.floor(Math.random() * workplaces.length)];
      const tragedyMessage = tragedies[Math.floor(Math.random() * tragedies.length)];

      // Crea el embed para mostrar la cantidad de monedas ganadas
      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setAuthor({ name: `Trabajo Completado!`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(`**${favoriteCard.idol}** y **${interaction.user.username}** fueron a trabajar a ${workplace} y ganaron ${earnedCoins} coins!\n**Después ${tragedyMessage}.**`)
        .setImage('https://imgur.com/yblBKFR.jpg');

      await interaction.reply({ embeds: [embed] });

      // Configura la notificación para cuando el cooldown haya pasado
      setTimeout(() => {
        interaction.channel.send(`<@${userId}>, el comando </work:1291579000325406797> ya está disponible nuevamente!`).catch(console.error);
      }, cooldownTime);

    } catch (error) {
      console.error('Error al ejecutar el comando /work:', error);
      await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  },
};
