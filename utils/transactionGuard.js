// utils/transactionGuard.js
module.exports = async (operation, rollbackOperation, interaction) => {
    try {
      // Ejecutar la operación principal (transferir carta/dinero)
      await operation();

      // Si todo salió bien, finalizamos normalmente.
      return;
    } catch (error) {
      console.error('Error en el comando:', error);

      // Si ocurrió un error, ejecutar la operación de rollback
      if (rollbackOperation) {
        try {
          await rollbackOperation();
        } catch (rollbackError) {
          console.error('Error al revertir la operación:', rollbackError);
        }
      }

      // Enviar un mensaje al usuario indicando que ocurrió un error
      await interaction.reply({ content: 'Ocurrió un error y la transacción no se completó. Inténtalo de nuevo.', ephemeral: true });
    }
  };
