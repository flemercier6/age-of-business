import type { GridPos } from '../../core/types';
import type { Projection } from './Projection';

/**
 * Projection top-down (vue de dessus), grille cartésienne classique :
 * la case (row, col) est un carré aligné sur les axes écran.
 *
 * Une future IsoProjection implémenterait la même interface avec une formule
 * en losange — aucun autre fichier n'aurait à changer.
 */
export class TopDownProjection implements Projection {
  constructor(
    private readonly originX: number,
    private readonly originY: number,
    public readonly tileWidth: number,
    public readonly tileHeight: number,
  ) {}

  tileToScreen(pos: GridPos): { x: number; y: number } {
    return {
      x: this.originX + pos.col * this.tileWidth + this.tileWidth / 2,
      y: this.originY + pos.row * this.tileHeight + this.tileHeight / 2,
    };
  }

  tileTopLeft(pos: GridPos): { x: number; y: number } {
    return {
      x: this.originX + pos.col * this.tileWidth,
      y: this.originY + pos.row * this.tileHeight,
    };
  }

  screenToTile(x: number, y: number): GridPos {
    return {
      col: Math.floor((x - this.originX) / this.tileWidth),
      row: Math.floor((y - this.originY) / this.tileHeight),
    };
  }
}
