// rarityUtils.js

const BOOSTER_ROLE_ID = '1077366130915672165'; // Reemplaza con el ID real del rol booster

const rarityProbabilities = {
  1: 70, // Común
  2: 20, // Poco común
  3: 10  // Raro
};

function getRandomRarity(probabilities) {
  const random = Math.random() * 100;
  let cumulativeProbability = 0;

  for (const [rarity, probability] of Object.entries(probabilities)) {
    cumulativeProbability += probability;
    if (random < cumulativeProbability) {
      return rarity;
    }
  }
}

async function selectCard(cards, member) {
  const hasBoosterRole = member.roles.cache.has(BOOSTER_ROLE_ID);

  const selectedRarity = getRandomRarity(hasBoosterRole ? {
    1: 60, // Aumentar la probabilidad de común
    2: 40, // Aumentar la probabilidad de poco común
    3: 20  // Mantener la probabilidad de raro
  } : rarityProbabilities);

  // Filtrar cartas por la rareza seleccionada
  const filteredCards = cards.filter(card => card.rarity == selectedRarity);

  // Si no hay cartas de la rareza seleccionada, devolver la primera
  return filteredCards.length > 0
    ? filteredCards[Math.floor(Math.random() * filteredCards.length)]
    : cards[Math.floor(Math.random() * cards.length)];
}

module.exports = {
  getRandomRarity,
  selectCard,
};
