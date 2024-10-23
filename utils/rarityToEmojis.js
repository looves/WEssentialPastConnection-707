// ../utils/rarityToEmojis.js
module.exports = (rarity) => {
    const emojis = {
        1: '<:stars:1296707011500838932>',
        2: '<:stars:1296707011500838932><:stars:1296707011500838932>',
        3: '<:stars:1296707011500838932><:stars:1296707011500838932><:stars:1296707011500838932>'
    };

    return emojis[rarity] || '<:stars:1296707011500838932>'; // Default a una estrella si la rareza es inválida
};
