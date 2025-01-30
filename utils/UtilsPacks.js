const packs = [
  {
    id: 'NPACK', // Unique ID for the pack
    name: 'Normal Pack', // Name of the pack
    url: 'https://i.imgur.com/VrlTgnB.png', // URL of the pack image
    price: 10, // Price of the pack in coins
    emoji: '<:npack:1333942830288338974>', // Emoji for the pack
    cardCount: 3, // Number of cards the pack contains
    rarity: [1], // Array of rarities that can appear in this pack
  }, 
  {
    id: 'RPACK', // Unique ID for the pack
    name: 'Rare Pack', // Name of the pack
    url: 'https://i.imgur.com/inVMJgd.png', // URL of the pack image
    price: 20, // Price of the pack in coins
    emoji: '<:rpack:1333942854430621728>', // Emoji for the pack
    cardCount: 3, // Number of cards the pack contains
    rarity: [1, 2], // Array of rarities that can appear in this pack
  },
  {
    id: 'UPACK', // Unique ID for the pack
    name: 'Ultra Pack', // Name of the pack
    url: 'https://i.imgur.com/m1gWLvf.png', // URL of the pack image
    price: 30, // Price of the pack in coins
    emoji: '<:upack:1333942875624439909>', // Emoji for the pack
    cardCount: 3, // Number of cards the pack contains
    rarity: [2], // Array of rarities that can appear in this pack
  },
  {
    id: 'EPACK', // Unique ID for the pack
    name: 'Epic Pack', // Name of the pack
    url: 'https://i.imgur.com/Jgq2tMS.png', // URL of the pack image
    price: 40, // Price of the pack in coins
    emoji: '<:epack:1333942889012527216>', // Emoji for the pack
    cardCount: 3, // Number of cards the pack contains
    rarity: [2, 3], // Array of rarities that can appear in this pack
  },
];

module.exports = packs;
