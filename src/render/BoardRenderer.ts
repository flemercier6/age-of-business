import Phaser from 'phaser';
import type { GameState } from '../core/gamestate';
import type { GridPos } from '../core/types';
import type { Projection } from './projection/Projection';
import { COLORS } from './theme';

/** Dessine la grille : fond des cases + lignes, avec highlight sur la case survolée. */
export class BoardRenderer {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(0);
  }

  sync(state: GameState, proj: Projection, hoveredTile: GridPos | null): void {
    const g = this.g;
    g.clear();
    const { rows, cols } = state.office;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const poly = proj.tilePolygon({ row, col });
        const hovered = hoveredTile?.row === row && hoveredTile?.col === col;
        g.fillStyle(hovered ? COLORS.cellHover : COLORS.cellEmpty, 1);
        g.fillPoints(poly, true);
        g.lineStyle(hovered ? 2 : 1, COLORS.gridLine, hovered ? 1 : 0.7);
        g.strokePoints(poly, true, true);
      }
    }
  }
}
