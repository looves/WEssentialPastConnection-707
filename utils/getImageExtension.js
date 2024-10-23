const path = require('path');

// Util para obtener la extensión de una imagen desde la URL o usar una por defecto
const getImageExtension = (imageUrl) => {
  // Extraer la extensión de la imagen, si existe. Si no, se asume '.png' por defecto.
  let extension = path.extname(imageUrl);

  // Si la URL no contiene una extensión, establece '.png' como valor predeterminado
  if (!extension) {
    extension = '.png';
  }

  // Lista de extensiones válidas
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif'];

  // Si la extensión no es válida (o vacía), se usa '.png' como valor predeterminado
  if (!validExtensions.includes(extension.toLowerCase())) {
    extension = '.png';
  }

  // Retornar la extensión con el punto incluido (e.g., '.png')
  return extension;
};

module.exports = getImageExtension;
