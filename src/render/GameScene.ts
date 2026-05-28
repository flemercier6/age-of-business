import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { applyCommand, type Command } from '../core/commands';
import { createInitialState, type GameState } from '../core/gamestate';
import { tick } from '../core/simulation';
import { Hud } from '../ui/Hud';
import { BoardRenderer } from './BoardRenderer';
import { EmployeeRenderer } from './EmployeeRenderer';
import { InputController } from './InputController';
import type { Projection } from './projection/Projection';
import { TopDownProjection } from './projection/TopDownProjection';
import { computeBoardLayout } from './theme';
import { ZoneRenderer } from './ZoneRenderer';

/**
 * Scène Phaser : possède l'état du jeu, pilote la boucle temps réel à pas fixe,
 * et orchestre rendu + entrées. Elle ne contient AUCUNE règle de gameplay :
 * tout passe par core/ (tick + applyCommand).
 */
export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private projection!: Projection;
  private layoutKey = '';
  private accumulator = 0;

  private board!: BoardRenderer;
  private zones!: ZoneRenderer;
  private employeesR!: EmployeeRenderer;
  private controller!: InputController;
  private hud!: Hud;

  constructor() {
    super('game');
  }

  create(): void {
    this.state = createInitialState(BALANCE);
    this.ensureProjection();

    this.board = new BoardRenderer(this);
    this.zones = new ZoneRenderer(this);
    this.employeesR = new EmployeeRenderer(this);
    this.hud = new Hud((cmd) => this.dispatch(cmd), BALANCE);
    this.controller = new InputController(
      this,
      this.state,
      (cmd) => this.dispatch(cmd),
      this.hud,
      () => this.projection,
      this.employeesR,
    );
  }

  /** Tous les ordres passent ici ; les échecs remontent un message au HUD. */
  private dispatch(cmd: Command): void {
    const res = applyCommand(this.state, cmd, BALANCE);
    if (!res.ok && res.reason) this.hud.flash(res.reason);
  }

  /**
   * (Re)construit la Projection quand les dimensions de la grille changent
   * (au démarrage et après un déménagement). C'est l'UNIQUE point de couplage
   * au type de projection : passer en iso = changer la classe instanciée ici.
   */
  private ensureProjection(): void {
    const { rows, cols } = this.state.office;
    const key = `${rows}x${cols}`;
    if (key === this.layoutKey) return;
    const layout = computeBoardLayout(rows, cols);
    this.projection = new TopDownProjection(
      layout.originX,
      layout.originY,
      layout.tile,
      layout.tile,
    );
    this.layoutKey = key;
  }

  override update(_time: number, deltaMs: number): void {
    this.ensureProjection();

    // Boucle temps réel à pas fixe (déterministe). Pause => on ne tick pas.
    if (!this.state.paused && !this.state.gameOver) {
      this.accumulator += deltaMs;
      const stepMs = BALANCE.simulation.fixedStepMs;
      let guard = 0;
      while (this.accumulator >= stepMs && guard < 10) {
        tick(this.state, stepMs / 1000, BALANCE);
        this.accumulator -= stepMs;
        guard++;
        if (this.state.gameOver) break;
      }
    }

    this.board.sync(this.state, this.projection);
    this.zones.sync(this.state, this.projection);
    this.employeesR.sync(this.state, this.projection, this.controller.selectedEmployeeId);
    this.hud.sync(this.state);
  }
}
