import Phaser from 'phaser';
import type { GameState } from '../core/gamestate';
import type { Projection } from './projection/Projection';
import { COLORS, ZONE_LETTER } from './theme';

/**
 * Dessine les zones (losanges colorés selon le type) et leur lettre.
 * Zone active (employé assigné) = opaque ; zone vide = transparente.
 */
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
      // Losange légèrement réduit vers le centre pour laisser voir le quadrillage.
      const poly = proj.tilePolygon(zone.pos).map((p) => ({
        x: center.x + (p.x - center.x) * 0.86,
        y: center.y + (p.y - center.y) * 0.86,
      }));
      const active = zone.assignedEmployeeId !== null;
      const color = COLORS.zone[zone.type];

      g.fillStyle(color, active ? COLORS.zoneActiveAlpha : COLORS.zoneInactiveAlpha);
      g.fillPoints(poly, true);
      g.lineStyle(2, color, active ? 1 : 0.4);
      g.strokePoints(poly, true, true);

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
      label.setAlpha(active ? 1 : 0.5);
    }

    // Nettoyage d'éventuels labels orphelins (robustesse).
    for (const [id, txt] of this.labels) {
      if (!seen.has(id)) {
        txt.destroy();
        this.labels.delete(id);
      }
    }
  }
}
