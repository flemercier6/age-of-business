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
import { IsoProjection } from './projection/IsoProjection';
import { computeBoardLayout } from './theme';
import { ZoneRenderer } from './ZoneRenderer';
import type { GridPos } from '../core/types';

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

  // Pan / zoom state
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private prevPinchDist = 0;
  private readonly PAN_THRESHOLD = 6;

  // Hover state
  private hoveredTile: GridPos | null = null;

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
      this.cameras.main,
    );

    // Disable browser context menu over the canvas.
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.setupCameraInput();
  }

  private dispatch(cmd: Command): void {
    const res = applyCommand(this.state, cmd, BALANCE);
    if (!res.ok && res.reason) this.hud.flash(res.reason);
  }

  private ensureProjection(): void {
    const { rows, cols } = this.state.office;
    const key = `${rows}x${cols}`;
    if (key === this.layoutKey) return;
    const layout = computeBoardLayout(rows, cols);
    this.projection = new IsoProjection(
      layout.originX,
      layout.originY,
      layout.tileWidth,
      layout.tileHeight,
    );
    this.layoutKey = key;
  }

  private setupCameraInput(): void {
    const cam = this.cameras.main;
    this.input.addPointer(2);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.controller.handleRightClick(p.x, p.y);
        return;
      }
      this.panStartX = p.x;
      this.panStartY = p.y;
      this.isPanning = false;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.input.pointer2.isDown) return;
      const dx = p.x - this.panStartX;
      const dy = p.y - this.panStartY;
      if (!this.isPanning && (Math.abs(dx) > this.PAN_THRESHOLD || Math.abs(dy) > this.PAN_THRESHOLD)) {
        this.isPanning = true;
      }
      if (this.isPanning) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.rightButtonReleased() && !this.isPanning) {
        this.controller.handleClick(p.x, p.y);
      }
      if (!this.input.pointer2.isDown) {
        this.isPanning = false;
        this.prevPinchDist = 0;
      }
    });

    // Scroll wheel zoom — zooms toward the pointer position.
    this.input.on('wheel', (p: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      const factor = dy > 0 ? 1 / 1.1 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * factor, 0.2, 5);
      const world = cam.getWorldPoint(p.x, p.y);
      cam.zoom = newZoom;
      const worldAfter = cam.getWorldPoint(p.x, p.y);
      cam.scrollX += world.x - worldAfter.x;
      cam.scrollY += world.y - worldAfter.y;
    });
  }

  private handlePinch(): void {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.prevPinchDist > 0 && dist > 0) {
        const cam = this.cameras.main;
        cam.zoom = Phaser.Math.Clamp(cam.zoom * (dist / this.prevPinchDist), 0.2, 5);
      }
      this.prevPinchDist = dist;
      this.isPanning = true;
    }
  }

  private updateHoveredTile(): void {
    const ptr = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const pos = this.projection.screenToTile(world.x, world.y);
    const { rows, cols } = this.state.office;
    this.hoveredTile =
      pos.row >= 0 && pos.row < rows && pos.col >= 0 && pos.col < cols ? pos : null;
  }

  override update(_time: number, deltaMs: number): void {
    this.handlePinch();
    this.ensureProjection();
    this.updateHoveredTile();

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

    this.board.sync(this.state, this.projection, this.hoveredTile);
    this.zones.sync(this.state, this.projection);
    this.employeesR.sync(this.state, this.projection, this.controller.selectedEmployeeId);
    this.hud.sync(this.state);
  }
}
