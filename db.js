// db.js
const mongoose = require('mongoose');
const Card = require('./models/Card'); // Asegúrate de que la ruta sea correcta

async function fetchData() {
    try {
        return await Card.find(); // Obtiene todas las cartas de la base de datos
    } catch (error) {
        console.error('Error al obtener las cartas:', error);
        throw error; // Re-lanza el error para que pueda ser manejado más arriba
    }
}

module.exports = { fetchData };
