const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Muestra el balance de monedas acumuladas del usuario.')
    .setIntegrationTypes([0, 1])
    .setContexts([0, 1, 2]),

  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      // Encuentra al usuario en la base de datos
      const user = await User.findOne({ userId: userId });

      if (!user) {
        return interaction.reply({ content: 'Perfil de usuario no encontrado.', ephemeral: true });
      }

      // Asegúrate de que el balance no sea NaN
      const coins = isNaN(user.coins) ? 0 : user.coins;

      // Crea el embed para mostrar el balance
      const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setAuthor({ name: `${interaction.user.username}'s Balance`, iconURL: interaction.user.displayAvatarURL() })
        .addFields(
          { name: 'Accumulated coins:', value: `<:dot:1291582825232994305><@${user.userId}> tienes **${coins}** :coin: coins.`, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error al ejecutar el comando balance:', error);
      await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  },
};
