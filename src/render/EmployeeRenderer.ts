import Phaser from 'phaser';
import type { GameState } from '../core/gamestate';
import { unassignedEmployees } from '../core/selectors';
import type { Projection } from './projection/Projection';
import { CANVAS, COLORS, LAYOUT } from './theme';

export type BenchHit = { kind: 'employee'; id: number } | { kind: 'bench' } | null;

/**
 * Dessine les employés sous forme de cercles :
 * - assignés : sur la case de leur zone, couleur de la zone ;
 * - non assignés : sur le "banc" en bas, couleur neutre.
 * Expose un hit-test pour le banc (sélection / désassignation).
 */
export class EmployeeRenderer {
  private g: Phaser.GameObjects.Graphics;
  private benchLabel: Phaser.GameObjects.Text;
  private benchSlots: { id: number; x: number; y: number; r: number }[] = [];
  private benchBand = { x0: 0, y0: 0, x1: 0, y1: 0 };

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(3);
    this.benchLabel = scene.add
      .text(8, 0, 'Banc (non assignés)', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: COLORS.benchLabel,
      })
      .setDepth(3);
  }

  sync(state: GameState, proj: Projection, selectedId: number | null): void {
    const g = this.g;
    g.clear();

    const byId = new Map(state.employees.map((e) => [e.id, e]));

    // Employés assignés, sur la case de leur zone.
    for (const zone of state.zones) {
      if (zone.assignedEmployeeId === null) continue;
      const emp = byId.get(zone.assignedEmployeeId);
      const c = proj.tileToScreen(zone.pos);
      const r = Math.min(proj.tileWidth, proj.tileHeight) * 0.17;
      // Cofounder = couleur distinctive ; sinon couleur de la zone.
      const color = emp?.isCofounder ? COLORS.cofounder : COLORS.zone[zone.type];
      this.drawDot(
        g,
        c.x,
        c.y + proj.tileHeight * 0.18,
        r,
        color,
        selectedId === zone.assignedEmployeeId,
      );
    }

    // Banc : employés non assignés.
    this.benchSlots = [];
    const bottom = proj.tileTopLeft({ row: state.office.rows, col: 0 }).y;
    const bandY0 = bottom + LAYOUT.benchTop;
    const slot = LAYOUT.benchSlot;
    const gap = LAYOUT.benchGap;
    const r = slot * 0.42;
    const cy = bandY0 + slot / 2;

    this.benchLabel.setPosition(LAYOUT.margin, bandY0 - 16);
    this.benchBand = { x0: 0, y0: bandY0 - 6, x1: CANVAS.width, y1: bandY0 + slot + 6 };

    const free = unassignedEmployees(state);
    const total = free.length * slot + Math.max(0, free.length - 1) * gap;
    let x = (CANVAS.width - total) / 2 + slot / 2;
    for (const emp of free) {
      const color = emp.isCofounder ? COLORS.cofounder : COLORS.employeeUnassigned;
      this.drawDot(g, x, cy, r, color, selectedId === emp.id);
      this.benchSlots.push({ id: emp.id, x, y: cy, r: r + 5 });
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

  /** Teste si un point écran touche un cercle du banc, ou la bande du banc. */
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
