import Phaser from 'phaser';
import type { Command } from '../core/commands';
import type { GameState } from '../core/gamestate';
import { inBounds } from '../core/office';
import { employeeAt, zoneAt } from '../core/selectors';
import type { GridPos } from '../core/types';
import type { Hud } from '../ui/Hud';
import type { EmployeeRenderer } from './EmployeeRenderer';
import type { Projection } from './projection/Projection';

/**
 * Traduit les entrées (clics canvas, ESPACE) en intentions, puis en Command.
 * - ESPACE : bascule la pause (ce n'est PAS un ordre, autorisé en pause).
 * - Clic plateau : sélection d'employé / assignation / menu de construction.
 * La conversion écran -> grille passe exclusivement par la Projection.
 */
export class InputController {
  selectedEmployeeId: number | null = null;

  constructor(
    scene: Phaser.Scene,
    private state: GameState,
    private dispatch: (cmd: Command) => void,
    private hud: Hud,
    private getProjection: () => Projection,
    private employees: EmployeeRenderer,
  ) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p.x, p.y));
    const kb = scene.input.keyboard;
    if (kb) {
      kb.addCapture('SPACE');
      kb.on('keydown-SPACE', () => {
        if (!this.state.gameOver) this.state.paused = !this.state.paused;
      });
    }
  }

  private onPointer(x: number, y: number): void {
    // Pause = observation : aucun ordre, aucune sélection.
    if (this.state.paused || this.state.gameOver) {
      this.selectedEmployeeId = null;
      this.hud.closeBuildMenu();
      return;
    }

    const proj = this.getProjection();
    const pos = proj.screenToTile(x, y);

    if (inBounds(this.state.office, pos)) {
      this.handleGridClick(pos);
      return;
    }

    // Hors grille : banc ou vide.
    const hit = this.employees.benchHitTest(x, y);
    if (hit?.kind === 'employee') {
      this.selectedEmployeeId = hit.id;
      this.hud.closeBuildMenu();
      return;
    }
    if (hit?.kind === 'bench') {
      // Clic sur le banc avec un employé assigné sélectionné => désassignation.
      if (this.selectedEmployeeId !== null) {
        const emp = this.state.employees.find((e) => e.id === this.selectedEmployeeId);
        if (emp && emp.assignedZoneId !== null) {
          this.dispatch({ kind: 'unassign', employeeId: emp.id });
        }
      }
      this.selectedEmployeeId = null;
      this.hud.closeBuildMenu();
      return;
    }

    // Clic ailleurs : on annule la sélection / ferme le menu.
    this.selectedEmployeeId = null;
    this.hud.closeBuildMenu();
  }

  private handleGridClick(pos: GridPos): void {
    const occupant = employeeAt(this.state, pos);
    const zone = zoneAt(this.state, pos);

    if (this.selectedEmployeeId !== null) {
      // Un employé est sélectionné : clic sur une zone => assignation.
      if (zone) this.dispatch({ kind: 'assign', employeeId: this.selectedEmployeeId, pos });
      this.selectedEmployeeId = null;
      this.hud.closeBuildMenu();
      return;
    }

    if (occupant) {
      // Sélectionne l'employé présent sur la case.
      this.selectedEmployeeId = occupant.id;
      this.hud.closeBuildMenu();
      return;
    }

    if (zone) {
      // Zone avec ou sans occupant → menu de recrutement / gestion.
      const occupant = zone.assignedEmployeeId !== null
        ? this.state.employees.find((e) => e.id === zone.assignedEmployeeId)
        : undefined;
      this.hud.openZoneMenu(zone, occupant);
      return;
    }

    // Case vide : menu de construction.
    this.hud.openBuildMenu(pos);
  }
}
