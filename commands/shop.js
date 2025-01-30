const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const packs = require('../utils/UtilsPacks');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Muestra los packs disponibles para comprar.'),
  async execute(interaction) {

    const userId = interaction.user.id;
    
    const embed = new EmbedBuilder()
      .setAuthor( { name: `Shop de Wonho's House`, iconURL: interaction.user.displayAvatarURL() } )
      .setColor('#60a5fa') // Hexadecimal color for the embed
      .addFields(
        {
          name: '\n',
          value: `\n`,
          inline: false
        },
        {
          name: 'Normal Pack <:npack:1333942830288338974>',
          value: `<:dot:1288002853436260394>**Precio:** 10 coins\n<:dot:1288002853436260394>**ID:** \`NPACK\``,
          inline: true
        },
        {
          name: 'Rare Pack <:rpack:1333942854430621728>',
          value: `<:dot:1288002853436260394>**Precio:** 20 coins\n<:dot:1288002853436260394>**ID:** \`RPACK\``,
          inline: true
        },
        {
          name: '\n',
          value: `\n`,
          inline: false
        },
        {
          name: 'Ultra Pack <:upack:1333942875624439909>',
          value: `<:dot:1288002853436260394>**Precio:** 30 coins\n<:dot:1288002853436260394>**ID:** \`UPACK\``,
          inline: true
        },
        {
          name: 'Epic Pack <:epack:1333942889012527216>',
          value: `<:dot:1288002853436260394>**Precio:** 40 coins\n<:dot:1288002853436260394>**ID:** \`EPACK\``,
          inline: true
        },
        {
          name: '\n',
          value: `\n`,
          inline: false
        },
      );

    await interaction.reply({ embeds: [embed] });
  },
};
