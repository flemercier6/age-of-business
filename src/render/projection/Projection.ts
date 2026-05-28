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

  /** Coin haut-gauche de la case à l'écran (px) — pour dessiner les rectangles. */
  tileTopLeft(pos: GridPos): { x: number; y: number };

  /**
   * Convertit un point écran en case grille (brut : peut renvoyer une case
   * hors de la grille, à valider via office.inBounds par l'appelant).
   */
  screenToTile(x: number, y: number): GridPos;
}
