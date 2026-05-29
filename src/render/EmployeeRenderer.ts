import Phaser from 'phaser';
import type { GameState } from '../core/gamestate';
import { unassignedEmployees } from '../core/selectors';
import type { Projection } from './projection/Projection';
import { CANVAS, COLORS, HUD_BOT_H, LAYOUT } from './theme';

export type BenchHit = { kind: 'employee'; id: number } | { kind: 'bench' } | null;

/**
 * Dessine les employés :
 * - assignés  : dans l'espace monde (suivent la caméra), triés par profondeur iso.
 * - non assignés : sur le "banc" fixe en bas de l'écran (scrollFactor 0).
 */
export class EmployeeRenderer {
  private worldG: Phaser.GameObjects.Graphics;
  private benchG: Phaser.GameObjects.Graphics;
  private benchLabel: Phaser.GameObjects.Text;
  private benchSlots: { id: number; x: number; y: number; r: number }[] = [];
  private benchBand = { x0: 0, y0: 0, x1: 0, y1: 0 };

  constructor(scene: Phaser.Scene, private readonly showBench = true, screenFixed = false) {
    this.worldG = scene.add.graphics().setDepth(3);
    if (screenFixed) this.worldG.setScrollFactor(0);
    this.benchG = scene.add.graphics().setDepth(5).setScrollFactor(0);
    const labelSize = Math.max(9, Math.round(11 * Math.min(CANVAS.width, 760) / 760));
    this.benchLabel = scene.add
      .text(8, 0, 'Banc (non assignés)', {
        fontFamily: 'monospace',
        fontSize: `${labelSize}px`,
        color: COLORS.benchLabel,
      })
      .setDepth(5)
      .setScrollFactor(0);
    if (!showBench) {
      this.benchG.setVisible(false);
      this.benchLabel.setVisible(false);
    }
  }

  sync(state: GameState, proj: Projection, selectedId: number | null): void {
    this.worldG.clear();
    if (this.showBench) this.benchG.clear();

    const byId = new Map(state.employees.map((e) => [e.id, e]));

    // Employés assignés — triés par profondeur iso (row+col) dans l'espace monde.
    const assigned = state.zones
      .filter((z) => z.assignedEmployeeId !== null)
      .sort((a, b) => a.pos.row + a.pos.col - (b.pos.row + b.pos.col));

    const r = Math.max(8, proj.tileWidth * 0.16);
    const lift = r * 0.7;
    for (const zone of assigned) {
      const emp = byId.get(zone.assignedEmployeeId as number);
      const c = proj.tileToScreen(zone.pos);
      const color = emp?.isCofounder ? COLORS.cofounder : COLORS.zone[zone.type];
      this.worldG.fillStyle(COLORS.shadow, 0.28);
      this.worldG.fillEllipse(c.x, c.y, r * 1.5, r * 0.7);
      this.drawDot(this.worldG, c.x, c.y - lift, r, color, selectedId === zone.assignedEmployeeId);
    }

    if (!this.showBench) return;

    // Banc — espace écran fixe, juste au-dessus du footer de contrôles.
    this.benchSlots = [];
    const bandY0 = CANVAS.height - HUD_BOT_H - LAYOUT.benchHeight + LAYOUT.benchTop;
    const slot = LAYOUT.benchSlot;
    const gap = LAYOUT.benchGap;
    const benchR = slot * 0.42;
    const cy = bandY0 + slot / 2;

    this.benchLabel.setPosition(LAYOUT.margin, bandY0 - 16);
    this.benchBand = { x0: 0, y0: bandY0 - 6, x1: CANVAS.width, y1: bandY0 + slot + 6 };

    const free = unassignedEmployees(state);
    const total = free.length * slot + Math.max(0, free.length - 1) * gap;
    let x = (CANVAS.width - total) / 2 + slot / 2;
    for (const emp of free) {
      const color = emp.isCofounder ? COLORS.cofounder : COLORS.employeeUnassigned;
      this.drawDot(this.benchG, x, cy, benchR, color, selectedId === emp.id);
      this.benchSlots.push({ id: emp.id, x, y: cy, r: Math.max(20, benchR + 5) });
      x += slot + gap;
    }
  }

  private drawDot(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    r: number,
    color: number,
    selected: boolean,
  ): void {
    if (selected) {
      g.lineStyle(3, COLORS.selectionRing, 1);
      g.strokeCircle(x, y, r + 5);
    }
    g.fillStyle(color, 1);
    g.fillCircle(x, y, r);
    g.lineStyle(2, COLORS.dotOutline, 0.4);
    g.strokeCircle(x, y, r);
  }

  /** Teste si un point ÉCRAN touche un cercle du banc ou la bande du banc. */
  benchHitTest(x: number, y: number): BenchHit {
    for (const s of this.benchSlots) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy <= s.r * s.r) return { kind: 'employee', id: s.id };
    }
    const b = this.benchBand;
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return { kind: 'bench' };
    return null;
  }
}
