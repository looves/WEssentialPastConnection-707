const Card = require('../models/Card');
const Inventory = require('../models/Inventory');

const incrementCardCount = async (userId, cardId) => {
  try {
    // Buscar la carta por su ID y actualizar el contador en una sola operación
    const card = await Card.findByIdAndUpdate(
      cardId,
      { $inc: { count: 1 } }, // Incrementar el contador de la carta
      { new: true } // Retornar la carta actualizada
    );

    if (!card) {
      throw new Error('Carta no encontrada');
    }

    // Actualizar el inventario del usuario, creando el inventario si no existe
    const inventory = await Inventory.findOneAndUpdate(
      { userId },
      { $setOnInsert: { cards: [] } }, // Asegurarse de que 'cards' exista
      { new: true, upsert: true } // Crear el inventario si no existe
    );

    // Verificar si la carta ya está en el inventario
    const cardInInventory = inventory.cards.find(c => c.cardId.toString() === card._id.toString());
    if (cardInInventory) {
      // Incrementar el contador si ya existe
      cardInInventory.count += 1;
    } else {
      // Agregar la carta al inventario si no existe
      inventory.cards.push({ cardId: card._id, count: 1 });
    }

    // Guardar los cambios en el inventario
    await inventory.save();

    // Retornar el número de copias y la carta actualizada
    return {
      copyNumber: card.count,
      card,
    };

  } catch (error) {
    console.error('Error al incrementar el conteo de la carta:', error);
    throw error;
  }
};

module.exports = incrementCardCount;
