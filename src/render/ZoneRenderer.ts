import Phaser from 'phaser';
import type { GameState } from '../core/gamestate';
import type { Projection } from './projection/Projection';
import { COLORS, ZONE_LETTER } from './theme';

/**
 * Dessine les zones (rectangles colorés selon le type) et leur lettre.
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
    const pad = Math.max(6, proj.tileWidth * 0.08);
    const seen = new Set<number>();

    for (const zone of state.zones) {
      seen.add(zone.id);
      const tl = proj.tileTopLeft(zone.pos);
      const active = zone.assignedEmployeeId !== null;
      const color = COLORS.zone[zone.type];

      g.fillStyle(color, active ? COLORS.zoneActiveAlpha : COLORS.zoneInactiveAlpha);
      g.fillRoundedRect(
        tl.x + pad,
        tl.y + pad,
        proj.tileWidth - pad * 2,
        proj.tileHeight - pad * 2,
        8,
      );

      let label = this.labels.get(zone.id);
      if (!label) {
        label = this.scene.add
          .text(0, 0, '', { fontFamily: 'monospace', fontSize: '20px', color: COLORS.textLight })
          .setDepth(2)
          .setOrigin(0.5, 0.5);
        this.labels.set(zone.id, label);
      }
      label.setText(ZONE_LETTER[zone.type]);
      label.setPosition(tl.x + proj.tileWidth / 2, tl.y + pad + 14);
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
