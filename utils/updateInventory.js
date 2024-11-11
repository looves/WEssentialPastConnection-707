const Inventory = require("../models/Inventory");

/**
 * Actualiza el inventario del usuario con las cartas obtenidas.
 * @param {string} userId - El ID del usuario.
 * @param {Array} cards - La lista de cartas obtenidas, cada una con `cardId` y `count`.
 */
const updateInventory = async (userId, cards) => {
  try {
    let inventory = await Inventory.findOne({ userId });

    if (!inventory) {
      inventory = new Inventory({ userId, cards: [] });
    }

    // Actualizar el inventario con las cartas obtenidas
    for (const card of cards) {
      const existingCard = inventory.cards.find(
        (c) => c.cardId.toString() === card.cardId.toString()
      );

      if (existingCard) {
        // Incrementar el número de copias si la carta ya existe
        existingCard.count += card.count;
      } else {
        // Añadir nueva carta con el número de copias especificado
        inventory.cards.push({ cardId: card.cardId, count: card.count });
      }
    }

    // Intentar guardar el inventario y manejar el error de versión
    try {
      await inventory.save();
    } catch (versionError) {
      if (versionError.name === 'VersionError') {
        // Si hay un conflicto de versión, volvemos a cargar el inventario y repetimos el proceso
        inventory = await Inventory.findOne({ userId });
        for (const card of cards) {
          const existingCard = inventory.cards.find(
            (c) => c.cardId.toString() === card.cardId.toString()
          );

          if (existingCard) {
            existingCard.count += card.count;
          } else {
            inventory.cards.push({ cardId: card.cardId, count: card.count });
          }
        }
        await inventory.save(); // Guardar nuevamente
      } else {
        throw versionError; // Rethrow si no es un error de versión
      }
    }

  } catch (error) {
    console.error("Error al actualizar el inventario:", error);
    throw new Error("No se pudo actualizar el inventario.");
  }
};

module.exports = updateInventory;
