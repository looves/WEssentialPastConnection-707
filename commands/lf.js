const { SlashCommandBuilder } = require('@discordjs/builders');
const User = require('../models/User');

module.exports = {
  data: new SlashCommandBuilder()
      .setName('looking')
      .setDescription('Agrega la carta que estas buscando.')
      .addSubcommand(subcommand => 
          subcommand
              .setName('for')
              .setDescription('Agrega la carta que estas buscando.')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('El texto que describe lo que estás buscando.')
        .setRequired(true))
    ),

  async execute(interaction) {
    const searchText = interaction.options.getString('text');
    const userId = interaction.user.id;

    try {
      if (interaction.options.getSubcommand() === 'for');

      // Encuentra al usuario
      let user = await User.findOne({ userId: userId });

      if (!user) {
        // Si no existe, crear un nuevo documento de usuario
        user = new User({ userId: userId, dailyUsage: [], botUsageCount: 0, cardCount: 0, coins: 0, searchText: '' });
      }

      // Actualiza el texto de búsqueda del usuario
      user.searchText = searchText;
      await user.save();

      await interaction.reply({ content: '**looking for** ha sido registrada exitosamente.', ephemeral: true });
    } catch (error) {
      console.error('Error al ejecutar el comando lf:', error);
      await interaction.reply({ content: 'Ocurrió un error al procesar el comando.', ephemeral: true });
    }
  },
};
