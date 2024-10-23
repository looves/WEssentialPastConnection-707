const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');

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
          return interaction.reply(`¡Debes esperar ${minutes} minutos y ${seconds} segundos antes de usar el comando /work nuevamente!`);
        }
      }

      // Verifica si el usuario tiene una carta favorita definida
      if (!user.favoriteCard) {
        return interaction.reply({ content: 'No puedes usar el comando `/work` sin una carta favorita definida. Establece una carta favorita primero.', ephemeral: true });
      }

      // Genera un número aleatorio entre 25 y 65
      const min = 25;
      const max = 75;
      const earnedCoins = Math.floor(Math.random() * (max - min + 1)) + min;

      // Actualiza el saldo de monedas del usuario
      user.coins = (user.coins || 0) + earnedCoins;

      // Actualizar el último uso del comando /work
      user.lastWork = new Date();
      await user.save();

      // Crea el embed para mostrar la cantidad de monedas ganadas
      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setAuthor({ name: `Trabajo Completado!`, value: interaction.user.displayAvatarURL() })
        .setDescription(`<:dot:1291582825232994305><@${user.userId}>, has ganado ${earnedCoins} :coin: coins!`)
        .setImage('https://imgur.com/m27u56C.jpg');

      await interaction.reply({ embeds: [embed] });

      // Configura la notificación para cuando el cooldown haya pasado
      setTimeout(() => {
        interaction.channel.send(`<@${userId}>, el comando **/work** ya está disponible nuevamente!`).catch(console.error);
      }, cooldownTime);

    } catch (error) {
      console.error('Error al ejecutar el comando /work:', error);
      await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  },
};
