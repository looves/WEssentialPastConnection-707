const crypto = require('crypto');

/**
 * Genera un código único para cada carta.
 * @param {string} idol - Nombre del idol.
 * @param {string} grupo - Nombre del grupo.
 * @param {string} era - Era de la carta.
 * @param {string} rarity - Rareza de la carta.
 * @param {string} [event] - Nombre del evento (opcional).
 * @returns {string} Código único generado.
 */
function generateCardCode(idol, grupo, era, rarity, event) {
    // Convertir los parámetros a cadena en caso de que no lo sean
    const idolInitial = String(idol).charAt(0).toUpperCase();

    // Limpiar el grupo y la era de caracteres especiales
    const cleanedGrupo = String(grupo).replace(/[^\w\s]/g, '');
    const cleanedEra = String(era).replace(/[^\w\s]/g, '');

    // Tomamos las primeras letras de cada uno
    const grupoInitial = cleanedGrupo.charAt(0).toUpperCase();
    const eraInitial = cleanedEra.charAt(0).toUpperCase();

    // Si hay un evento, usamos 'E', si no, usamos la rareza
    const rarityOrEventInitial = event ? 'E' : String(rarity).charAt(0).toUpperCase();

    // Generar una secuencia aleatoria de 4 caracteres
    const randomString = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 caracteres hexadecimales (2 bytes)

    // Formar el código final con el formato deseado: 'HZXE.865F'
    return `${idolInitial}${grupoInitial}${eraInitial}${rarityOrEventInitial}.${randomString}`;
}

module.exports = generateCardCode;
