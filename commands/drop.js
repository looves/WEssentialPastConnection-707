const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, AttachmentBuilder, GuildMember } = require('discord.js');
const Card = require('../models/Card');
const DroppedCard = require('../models/DroppedCard');
const User = require('../models/User');
const updateInventory = require('../utils/updateInventory');
const incrementCardCount = require('../utils/incrementCardCount');
const generateCardCode = require('../utils/generateCardCode');
const getImageExtension = require('../utils/getImageExtension');
const { selectCard } = require('../utils/rarityUtils');
const checkBan = require('../utils/checkBan');

const BASE_COOLDOWN_TIME = 8 * 60 * 1000;
const BOOSTER_COOLDOWN_TIME = 7 * 60 * 1000;
const WENEE_COOLDOWN_TIME = 6 * 60 * 1000;
const SEOKI_COOLDOWN_TIME = 5 * 60 * 1000;

const getCooldownTime = (member) => {
    if (member.roles.cache.has('1327386590758309959')) return SEOKI_COOLDOWN_TIME;
    if (member.roles.cache.has('1281839512829558844')) return WENEE_COOLDOWN_TIME;
    if (member.roles.cache.has('1077366130915672165')) return BOOSTER_COOLDOWN_TIME;
    return BASE_COOLDOWN_TIME;
};

const createCardEmbed = (interaction, selectedCard, uniqueCode, copyNumber, level, imageUrl, cardCode) => {
    const extension = getImageExtension(imageUrl);
    const attachment = new AttachmentBuilder(imageUrl, { name: `${cardCode}${extension}` });
    const embed = new EmbedBuilder()
        .setColor('#60a5fa')
        .setDescription(`_ _<@${interaction.user.id}>, adquiriste a \`${selectedCard.idol}\` de **${selectedCard.grupo}**\n_ _ **${selectedCard.era || selectedCard.event}** <:dot:1291582825232994305> \`#${copyNumber}\`\n_ _ \`\`\`${uniqueCode}\`\`\`\n_ _　[server support](https://discord.gg/wonho) | [patreon](https://www.patreon.com/wonhobot) | \`${level}\``);
    return { embed, attachment };
};

const handleCooldown = async (userId, cooldownTime, currentTime, interaction) => {
    const user = await User.findOne({ userId });
    if (user.lastDrop) {
        const timeElapsed = currentTime - new Date(user.lastDrop).getTime();
        if (timeElapsed < cooldownTime) {
            const remainingTime = cooldownTime - timeElapsed;
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            return interaction.editReply(`¡Debes esperar \`${minutes}\` minutos y \`${seconds}\` segundos antes de usar el comando nuevamente!`);
        }
    }
    return null;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drop')
        .setDescription('Obtén una card aleatoria.')
        .setIntegrationTypes([0, 1])
        .setContexts([0, 1, 2]),

    async execute(interaction) {
        const userId = interaction.user.id;
        const currentTime = Date.now();
        
        try {
            await interaction.deferReply();

            await User.findOneAndUpdate(
                { userId },
                { $setOnInsert: { username: interaction.user.tag } },
                { upsert: true }
            );

            if (await checkBan(userId)) {
                return interaction.editReply(`No puedes usar el comando \`/drop\` porque estás baneado.\n-# Si crees que estás baneado por error, abre ticket en Wonho's House <#1248108503973757019>.`);
            }

            const cards = await Card.aggregate([
                { $match: {} }, // Esto selecciona todas las cartas sin filtros.
                { $sample: { size: 1 } } // Toma una carta aleatoria.
                ]);


            if (cards.length === 0) return interaction.editReply('No hay cartas disponibles en la base de datos.');

            const member = interaction.guild ? await interaction.guild.members.fetch(userId) : interaction.user;
            const cooldownTime = getCooldownTime(member);
            
            const cooldownResponse = await handleCooldown(userId, cooldownTime, currentTime, interaction);
            if (cooldownResponse) return cooldownResponse;

            const selectedCard = await selectCard(cards, member);
            const uniqueCode = generateCardCode(selectedCard.idol, selectedCard.grupo, selectedCard.era, String(selectedCard.rarity), selectedCard.event);
            const cardCode = `${selectedCard.idol[0]}${selectedCard.grupo[0]}${selectedCard.era[0]}${selectedCard.event || selectedCard.rarity}`;
            const { copyNumber } = await incrementCardCount(userId, selectedCard._id);

            if (copyNumber <= 0) return interaction.editReply('No se pudo incrementar el contador de la carta.');

            const level = member instanceof GuildMember ? (member.roles.cache.has('1327386590758309959') ? 'level 3' : member.roles.cache.has('1281839512829558844') ? 'level 2' : member.roles.cache.has('1077366130915672165') ? 'level 1' : 'level 0') : 'level 0';

            const { embed, attachment } = createCardEmbed(interaction, selectedCard, uniqueCode, copyNumber, level, selectedCard.image, cardCode);

            await interaction.editReply({ embeds: [embed], files: [attachment] });

            const droppedCard = new DroppedCard({
                userId,
                cardId: selectedCard._id,
                idol: selectedCard.idol,
                grupo: selectedCard.grupo,
                era: selectedCard.era,
                eshort: selectedCard.eshort,
                rarity: selectedCard.rarity,
                event: selectedCard.event,
                uniqueCode,
                command: '/drop',
                copyNumber,
            });

            await Promise.all([
                droppedCard.save(),
                updateInventory(userId, [{ cardId: selectedCard._id, count: copyNumber }]),
                User.findOneAndUpdate({ userId }, { lastDrop: new Date() })
            ]);

            setTimeout(() => {
                if (interaction.guild) {
                    interaction.channel.send(`<@${userId}>, el comando </drop:1291579000044650509> ya está disponible nuevamente!`).catch(console.error);
                } else {
                    interaction.user.send(`¡El comando </drop:1291579000044650509> ya está disponible nuevamente!`).catch(console.error);
                }
            }, cooldownTime);

        } catch (error) {
            console.error('Error al procesar el comando /drop:', error);
            if (error.name === 'VersionError') {
                return interaction.editReply('Hubo un conflicto al actualizar tu inventario. Por favor, intenta nuevamente.');
            }
            await interaction.editReply('Hubo un error al intentar obtener la carta. Por favor, inténtalo de nuevo.');
        }
    },
};
