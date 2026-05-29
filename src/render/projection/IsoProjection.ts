import type { GridPos } from '../../core/types';
import type { Projection } from './Projection';

/**
 * Projection isométrique 2:1 (losange large deux fois plus que haut).
 * - l'axe COL part vers le bas-droite de l'écran ;
 * - l'axe ROW part vers le bas-gauche.
 * La case (row, col) est un losange dont le centre est donné par tileToScreen.
 *
 * Implémente la même interface que TopDownProjection : ni la logique (core/)
 * ni les renderers ne savent quelle projection est active — seul GameScene
 * choisit la classe à instancier.
 */
export class IsoProjection implements Projection {
  private readonly hw: number;
  private readonly hh: number;

  constructor(
    private readonly originX: number,
    private readonly originY: number,
    public readonly tileWidth: number,
    public readonly tileHeight: number,
  ) {
    this.hw = tileWidth / 2;
    this.hh = tileHeight / 2;
  }

  tileToScreen(pos: GridPos): { x: number; y: number } {
    return {
      x: this.originX + (pos.col - pos.row) * this.hw,
      y: this.originY + (pos.col + pos.row) * this.hh,
    };
  }

  /** Coin haut-gauche de la boîte englobante du losange (compat interface). */
  tileTopLeft(pos: GridPos): { x: number; y: number } {
    const c = this.tileToScreen(pos);
    return { x: c.x - this.hw, y: c.y - this.hh };
  }

  tilePolygon(pos: GridPos): { x: number; y: number }[] {
    const c = this.tileToScreen(pos);
    return [
      { x: c.x, y: c.y - this.hh }, // haut
      { x: c.x + this.hw, y: c.y }, // droite
      { x: c.x, y: c.y + this.hh }, // bas
      { x: c.x - this.hw, y: c.y }, // gauche
    ];
  }

  screenToTile(x: number, y: number): GridPos {
    // Inverse exacte de tileToScreen : la grille iso pave le plan, on arrondit
    // au centre de losange le plus proche.
    const dx = (x - this.originX) / this.hw; // = col - row
    const dy = (y - this.originY) / this.hh; // = col + row
    return {
      col: Math.round((dx + dy) / 2),
      row: Math.round((dy - dx) / 2),
    };
  }
}
