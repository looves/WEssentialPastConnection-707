// ../utils/rarityToEmojis.js
module.exports = (rarityOrEvent) => {
    const emojis = {
        1: '<:stars:1296707011500838932>',
        2: '<:stars:1296707011500838932><:stars:1296707011500838932>',
        3: '<:stars:1296707011500838932><:stars:1296707011500838932><:stars:1296707011500838932>',

        XMAS: '<:xmas:1321692124554723389>'
    };

    if (typeof rarityOrEvent === 'string' && emojis[rarityOrEvent]) {
        return emojis[rarityOrEvent];
    }

    return emojis[rarityOrEvent] || '<:stars:1296707011500838932>'; // Default a una estrella si la rareza es inválida
};
