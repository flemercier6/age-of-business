import Phaser from 'phaser';
import type { GameState } from '../core/gamestate';
import type { Projection } from './projection/Projection';
import { COLORS } from './theme';

/** Dessine la grille : fond des cases + lignes. Redessiné chaque frame. */
export class BoardRenderer {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(0);
  }

  sync(state: GameState, proj: Projection): void {
    const g = this.g;
    g.clear();
    const { rows, cols } = state.office;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tl = proj.tileTopLeft({ row, col });
        g.fillStyle(COLORS.cellEmpty, 1);
        g.fillRect(tl.x + 1, tl.y + 1, proj.tileWidth - 2, proj.tileHeight - 2);
        g.lineStyle(2, COLORS.gridLine, 1);
        g.strokeRect(tl.x + 1, tl.y + 1, proj.tileWidth - 2, proj.tileHeight - 2);
      }
    }
  }
}
