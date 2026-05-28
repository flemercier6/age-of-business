/**
 * Les ressources continues du jeu.
 * - cash  : trésorerie (game over si <= 0).
 * - tech  : produite par Engineering ; débloque le MVP.
 * - brand : réputation ; multiplie l'acquisition de clients par Sales.
 *
 * Les CLIENTS ne sont PAS ici : ce sont des entités individuelles (avec un
 * nombre de versements restant), stockées dans GameState.clients.
 */
export interface Resources {
  cash: number;
  tech: number;
  brand: number;
}
