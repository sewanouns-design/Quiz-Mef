export interface Verse {
  text: string;
  reference: string;
}

export const VERSES: Verse[] = [
  { text: "Sonde les écritures, car ce sont elles qui rendent témoignage de moi.", reference: "Jean 5:39" },
  { text: "Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.", reference: "Psaume 119:105" },
  { text: "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse.", reference: "Proverbes 3:5" },
  { text: "Que ce livre de la loi ne s'éloigne point de ta bouche ; médite-le jour et nuit.", reference: "Josué 1:8" },
  { text: "Toute Écriture est inspirée de Dieu et utile pour enseigner, pour convaincre.", reference: "2 Timothée 3:16" },
  { text: "Il trouve son plaisir dans la loi de l'Éternel, et il la médite jour et nuit.", reference: "Psaume 1:2" },
  { text: "Garde ton cœur plus que toute autre chose, car de lui viennent les sources de la vie.", reference: "Proverbes 4:23" },
  { text: "Cherchez premièrement le royaume et la justice de Dieu, et tout cela vous sera donné.", reference: "Matthieu 6:33" },
  { text: "Je puis tout par celui qui me fortifie.", reference: "Philippiens 4:13" },
  { text: "Mettez en pratique la parole, et ne vous bornez pas à l'écouter.", reference: "Jacques 1:22" },
  { text: "L'âme paresseuse a des désirs qu'elle ne peut satisfaire, mais l'âme des diligents sera rassasiée.", reference: "Proverbes 13:4" },
  { text: "Tout ce que ta main trouve à faire avec ta force, fais-le.", reference: "Ecclésiaste 9:10" },
  { text: "Tout ce que vous faites, faites-le de bon cœur, comme pour le Seigneur.", reference: "Colossiens 3:23" },
  { text: "Ayez du zèle, et non de la paresse. Soyez fervents d'esprit.", reference: "Romains 12:11" },
  { text: "Ne nous lassons pas de faire le bien, car nous moissonnerons au temps convenable.", reference: "Galates 6:9" },
];

export function getRandomVerse(): Verse {
  return VERSES[Math.floor(Math.random() * VERSES.length)];
}
