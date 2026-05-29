import type { GridPos } from '../../core/types';

/**
 * ============================================================================
 *  Projection — LE module unique de conversion grille <-> écran.
 * ============================================================================
 *  C'est l'UNIQUE endroit du code qui connaît à la fois les (row/col) et les
 *  pixels. Les renderers et l'input ne dépendent QUE de cette interface.
 *
 *  Objectif d'architecture : passer plus tard en isométrique = écrire une
 *  nouvelle classe IsoProjection implements Projection, sans toucher ni à la
 *  logique (core/), ni aux renderers. On ne change qu'UNE ligne dans GameScene.
 * ============================================================================
 */
export interface Projection {
  readonly tileWidth: number;
  readonly tileHeight: number;

  /** Centre de la case à l'écran (px). */
  tileToScreen(pos: GridPos): { x: number; y: number };

  /** Coin haut-gauche de la boîte englobante de la case (px). */
  tileTopLeft(pos: GridPos): { x: number; y: number };

  /**
   * Les sommets du polygone de la case dans l'ordre (sens horaire), prêts à
   * être remplis/tracés. Rectangle en top-down, losange en isométrique : les
   * renderers ne dessinent QUE ce polygone, sans connaître la projection.
   */
  tilePolygon(pos: GridPos): { x: number; y: number }[];

  /**
   * Convertit un point écran en case grille (brut : peut renvoyer une case
   * hors de la grille, à valider via office.inBounds par l'appelant).
   */
  screenToTile(x: number, y: number): GridPos;
}
