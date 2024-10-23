const crypto = require('crypto');

/**
 * Genera un código único para cada carta.
 * @param {string} idol - Nombre del idol.
 * @param {string} grupo - Nombre del grupo.
 * @param {string} era - Era de la carta.
 * @param {string} rarity - Rareza de la carta.
 * @returns {string} Código único generado.
 */
function generateCardCode(idol, grupo, era, rarity) {
    // Convertir los parámetros a cadena en caso de que no lo sean
    const idolInitial = String(idol).charAt(0).toUpperCase();
    const grupoInitial = String(grupo).charAt(0).toUpperCase();
    const eraInitial = String(era).charAt(0).toUpperCase();
    const rarityInitial = String(rarity).charAt(0).toUpperCase();

    // Generar una secuencia aleatoria de 4 caracteres
    const randomString = crypto.randomBytes(2).toString('hex').toUpperCase(); // Genera 4 caracteres hexadecimales

    // Formar el código final
    return `${idolInitial}${grupoInitial}${eraInitial}${rarityInitial}.${randomString}`;
}

module.exports = generateCardCode;
