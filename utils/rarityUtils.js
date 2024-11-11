// rarityUtils.js

const BOOSTER_ROLE_ID = '1077366130915672165'; // Reemplaza con el ID real del rol booster
const PATREON_ROLE_ID = '1281839512829558844'; // Reemplaza con el ID real del rol patreon

const rarityProbabilities = {
  1: 70, // Común
  2: 27, // Poco común
  3: 3  // Raro
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
  const hasPatreonRole = member.roles.cache.has(PATREON_ROLE_ID);

  let selectedRarity;

  if (hasBoosterRole) {
    selectedRarity = getRandomRarity({
      1: 57, // Aumentar la probabilidad de común para Booster
      2: 35, // Aumentar la probabilidad de poco común para Booster
      3: 8  // Mantener la probabilidad de raro para Booster
    });
  } else if (hasPatreonRole) {
    selectedRarity = getRandomRarity({
      1: 48, // Aumentar la probabilidad de común para Patreon
      2: 40, // Aumentar la probabilidad de poco común para Patreon
      3: 12  // Aumentar la probabilidad de raro para Patreon
    });
  } else {
    selectedRarity = getRandomRarity(rarityProbabilities);
  }

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
