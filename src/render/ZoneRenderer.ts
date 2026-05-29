import Phaser from 'phaser';
import type { GameState } from '../core/gamestate';
import type { Projection } from './projection/Projection';
import { COLORS, ZONE_LETTER } from './theme';

export class ZoneRenderer {
  private g: Phaser.GameObjects.Graphics;
  private labels = new Map<number, Phaser.GameObjects.Text>();

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1);
  }

  sync(state: GameState, proj: Projection): void {
    const g = this.g;
    g.clear();
    const seen = new Set<number>();

    for (const zone of state.zones) {
      seen.add(zone.id);
      const center = proj.tileToScreen(zone.pos);
      const underConstruction = zone.buildSecondsRemaining > 0;
      const active = zone.assignedEmployeeId !== null;
      const color = COLORS.zone[zone.type];

      // Losange de la zone (légèrement réduit pour laisser voir la grille).
      const poly = proj.tilePolygon(zone.pos).map((p) => ({
        x: center.x + (p.x - center.x) * 0.86,
        y: center.y + (p.y - center.y) * 0.86,
      }));

      let fillAlpha: number;
      let strokeAlpha: number;
      if (underConstruction) {
        fillAlpha = 0.18;
        strokeAlpha = 0.5;
      } else {
        fillAlpha = active ? COLORS.zoneActiveAlpha : COLORS.zoneInactiveAlpha;
        strokeAlpha = active ? 1 : 0.4;
      }

      g.fillStyle(color, fillAlpha);
      g.fillPoints(poly, true);
      g.lineStyle(2, color, strokeAlpha);
      g.strokePoints(poly, true, true);

      // Barre de progression pendant la construction.
      if (underConstruction && zone.buildTotalSec > 0) {
        const progress = 1 - zone.buildSecondsRemaining / zone.buildTotalSec;
        const topY = center.y - proj.tileHeight / 2 - 4;
        const barW = proj.tileWidth * 0.55;
        const barH = Math.max(4, Math.round(proj.tileHeight * 0.1));
        const barX = center.x - barW / 2;

        // Fond
        g.fillStyle(0x313244, 0.95);
        g.fillRect(barX, topY - barH, barW, barH);
        // Remplissage (couleur de la zone)
        if (progress > 0) {
          g.fillStyle(color, 1);
          g.fillRect(barX, topY - barH, barW * progress, barH);
        }
        // Contour
        g.lineStyle(1, 0x45475a, 1);
        g.strokeRect(barX, topY - barH, barW, barH);
      }

      // Lettre du département.
      const fontSize = Math.max(10, Math.round(proj.tileHeight * 0.55));
      let label = this.labels.get(zone.id);
      if (!label) {
        label = this.scene.add
          .text(0, 0, '', { fontFamily: 'monospace', fontSize: `${fontSize}px`, color: COLORS.textLight })
          .setDepth(2)
          .setOrigin(0.5, 0.5);
        this.labels.set(zone.id, label);
      }
      label.setFontSize(fontSize);
      label.setText(ZONE_LETTER[zone.type]);
      label.setPosition(center.x, center.y);
      label.setAlpha(underConstruction ? 0.3 : active ? 1 : 0.5);
    }

    for (const [id, txt] of this.labels) {
      if (!seen.has(id)) {
        txt.destroy();
        this.labels.delete(id);
      }
    }
  }
}
