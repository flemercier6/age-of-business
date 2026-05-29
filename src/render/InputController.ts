import Phaser from 'phaser';
import type { Command } from '../core/commands';
import type { GameState } from '../core/gamestate';
import { inBounds } from '../core/office';
import { employeeAt, zoneAt } from '../core/selectors';
import type { GridPos } from '../core/types';
import type { Hud } from '../ui/Hud';
import type { EmployeeRenderer } from './EmployeeRenderer';
import type { Projection } from './projection/Projection';
import { CANVAS } from './theme';

/**
 * Traduit les entrées en Command.
 * - Clic gauche  : sélectionner un employé / ouvrir un menu — jamais d'assignation.
 * - Clic droit   : assigner l'employé sélectionné à la zone sous le curseur.
 * - ESPACE       : pause.
 * GameScene filtre drag vs clic et appelle handleClick / handleRightClick.
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
    private camera: Phaser.Cameras.Scene2D.Camera,
  ) {
    const kb = scene.input.keyboard;
    if (kb) {
      kb.addCapture('SPACE');
      kb.on('keydown-SPACE', () => {
        if (!this.state.gameOver) this.state.paused = !this.state.paused;
      });
    }
  }

  /** Clic gauche confirmé (pas un drag). */
  handleClick(screenX: number, screenY: number): void {
    if (!this.guardCommon(screenX, screenY)) return;

    // Banc en espace écran — prioritaire sur la grille.
    const benchHit = this.employees.benchHitTest(screenX, screenY);
    if (benchHit?.kind === 'employee') {
      this.selectedEmployeeId = benchHit.id;
      return;
    }
    if (benchHit?.kind === 'bench') {
      if (this.selectedEmployeeId !== null) {
        const emp = this.state.employees.find((e) => e.id === this.selectedEmployeeId);
        if (emp && emp.assignedZoneId !== null) {
          this.dispatch({ kind: 'unassign', employeeId: emp.id });
        }
      }
      this.selectedEmployeeId = null;
      return;
    }

    const pos = this.worldTile(screenX, screenY);
    if (!pos || !inBounds(this.state.office, pos)) {
      this.selectedEmployeeId = null;
      return;
    }
    this.handleGridLeftClick(pos);
  }

  /** Clic droit — assigne l'employé sélectionné à la case visée. */
  handleRightClick(screenX: number, screenY: number): void {
    if (!this.guardCommon(screenX, screenY)) return;

    const pos = this.worldTile(screenX, screenY);
    if (pos && inBounds(this.state.office, pos) && this.selectedEmployeeId !== null) {
      const zone = zoneAt(this.state, pos);
      if (zone) this.dispatch({ kind: 'assign', employeeId: this.selectedEmployeeId, pos });
    }
    this.selectedEmployeeId = null;
  }

  // ---- Private helpers ----

  /** Vérifie les conditions bloquantes communes aux deux types de clic. Retourne false si bloqué. */
  private guardCommon(screenX: number, screenY: number): boolean {
    if (screenX < 0 || screenX > CANVAS.width || screenY < 0 || screenY > CANVAS.height) return false;
    if (screenX > CANVAS.width / 2) return false; // zone du board IA — ignorer
    if (this.state.gameOver) return false;
    if (this.hud.isMenuOpen()) {
      this.hud.closeOverlay();
      return false;
    }
    if (this.state.paused) {
      this.selectedEmployeeId = null;
      return false;
    }
    return true;
  }

  /** Convertit les coordonnées écran en position monde → case grille. */
  private worldTile(screenX: number, screenY: number): GridPos | null {
    const world = this.camera.getWorldPoint(screenX, screenY);
    return this.getProjection().screenToTile(world.x, world.y);
  }

  private handleGridLeftClick(pos: GridPos): void {
    // Employé sélectionné : le clic gauche déselectionne (le clic droit assigne).
    if (this.selectedEmployeeId !== null) {
      this.selectedEmployeeId = null;
      return;
    }

    const occupant = employeeAt(this.state, pos);
    if (occupant) {
      this.selectedEmployeeId = occupant.id;
      return;
    }

    const zone = zoneAt(this.state, pos);
    if (zone) {
      if (zone.buildSecondsRemaining > 0) {
        this.hud.flash(`En construction — encore ${Math.ceil(zone.buildSecondsRemaining)}s`);
        return;
      }
      const emp = zone.assignedEmployeeId !== null
        ? this.state.employees.find((e) => e.id === zone.assignedEmployeeId)
        : undefined;
      this.hud.openZoneMenu(zone, emp);
      return;
    }

    this.hud.openBuildMenu(pos);
  }
}
