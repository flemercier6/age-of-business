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
 * Traduit les clics canvas en intentions puis en Command.
 * Les événements pointerdown/pointerup sont gérés par GameScene (qui filtre
 * drag vs clic) ; seul le clic abouti arrive ici via handleClick().
 * La conversion écran → monde passe par camera.getWorldPoint() avant screenToTile().
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

  /** Appelé par GameScene uniquement quand le geste est un clic (pas un drag). */
  handleClick(screenX: number, screenY: number): void {
    if (screenX < 0 || screenX > CANVAS.width || screenY < 0 || screenY > CANVAS.height) return;
    if (this.state.gameOver) return;

    if (this.hud.isMenuOpen()) {
      this.hud.closeOverlay();
      return;
    }

    if (this.state.paused) {
      this.selectedEmployeeId = null;
      return;
    }

    // Le banc est en espace écran (scrollFactor 0) — tester avant la grille.
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

    // Convertir écran → monde pour les interactions avec la grille.
    const world = this.camera.getWorldPoint(screenX, screenY);
    const proj = this.getProjection();
    const pos = proj.screenToTile(world.x, world.y);

    if (inBounds(this.state.office, pos)) {
      this.handleGridClick(pos);
      return;
    }

    this.selectedEmployeeId = null;
  }

  private handleGridClick(pos: GridPos): void {
    const occupant = employeeAt(this.state, pos);
    const zone = zoneAt(this.state, pos);

    if (this.selectedEmployeeId !== null) {
      if (zone) this.dispatch({ kind: 'assign', employeeId: this.selectedEmployeeId, pos });
      this.selectedEmployeeId = null;
      return;
    }

    if (occupant) {
      this.selectedEmployeeId = occupant.id;
      return;
    }

    if (zone) {
      const occupant = zone.assignedEmployeeId !== null
        ? this.state.employees.find((e) => e.id === zone.assignedEmployeeId)
        : undefined;
      this.hud.openZoneMenu(zone, occupant);
      return;
    }

    this.hud.openBuildMenu(pos);
  }
}
