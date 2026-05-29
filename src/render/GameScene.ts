import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { applyCommand, type Command } from '../core/commands';
import { aiDecide } from '../core/aiPlayer';
import { createInitialState, type GameState } from '../core/gamestate';
import { tick } from '../core/simulation';
import { Hud } from '../ui/Hud';
import { BoardRenderer } from './BoardRenderer';
import { EmployeeRenderer } from './EmployeeRenderer';
import { InputController } from './InputController';
import type { Projection } from './projection/Projection';
import { IsoProjection } from './projection/IsoProjection';
import { CANVAS, computeBoardLayout, HUD_BOT_H, HUD_TOP_H } from './theme';
import { ZoneRenderer } from './ZoneRenderer';
import type { GridPos } from '../core/types';

export class GameScene extends Phaser.Scene {
  // States
  private state!: GameState;
  private aiState!: GameState;

  // Projections
  private projection!: Projection;
  private aiProjection!: Projection;
  private layoutKey = '';
  private aiLayoutKey = '';

  // Simulation
  private accumulator = 0;
  private aiDecideTimer = 0;

  // Player renderers (world-space, left half)
  private board!: BoardRenderer;
  private zones!: ZoneRenderer;
  private employeesR!: EmployeeRenderer;

  // AI renderers (screen-fixed, right half)
  private aiBoard!: BoardRenderer;
  private aiZones!: ZoneRenderer;
  private aiEmployeesR!: EmployeeRenderer;

  private controller!: InputController;
  private hud!: Hud;
  private dividerG!: Phaser.GameObjects.Graphics;

  // Race
  private raceWinner: 'player' | 'ai' | null = null;

  // Pan / zoom
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private prevPinchDist = 0;
  private prevPinchMidX = 0;
  private prevPinchMidY = 0;
  private readonly PAN_THRESHOLD = 6;

  private hoveredTile: GridPos | null = null;

  constructor() {
    super('game');
  }

  create(): void {
    const halfW = CANVAS.width / 2;

    // --- État joueur + renderers (moitié gauche, espace monde) ---
    this.state = createInitialState(BALANCE);
    this.ensureProjection();

    this.board = new BoardRenderer(this, 0, false);
    this.zones = new ZoneRenderer(this, 1, false);
    this.employeesR = new EmployeeRenderer(this, true, false);

    // --- État IA + renderers (moitié droite, fixés à l'écran) ---
    this.aiState = createInitialState(BALANCE);
    this.ensureAiProjection();

    this.aiBoard = new BoardRenderer(this, 0, true);
    this.aiZones = new ZoneRenderer(this, 1, true);
    this.aiEmployeesR = new EmployeeRenderer(this, false, true); // pas de banc

    // --- HUD & InputController ---
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

    // --- Séparateur vertical ---
    this.dividerG = this.add.graphics().setScrollFactor(0).setDepth(4);
    this.drawDivider();

    // Désactive menu contextuel et zoom navigateur sur pinch.
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.game.canvas.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

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
    const halfW = CANVAS.width / 2;
    const layout = computeBoardLayout(rows, cols, 0, halfW);
    this.projection = new IsoProjection(layout.originX, layout.originY, layout.tileWidth, layout.tileHeight);
    this.layoutKey = key;
  }

  private ensureAiProjection(): void {
    const { rows, cols } = this.aiState.office;
    const key = `ai-${rows}x${cols}`;
    if (key === this.aiLayoutKey) return;
    const halfW = CANVAS.width / 2;
    const layout = computeBoardLayout(rows, cols, halfW, halfW);
    this.aiProjection = new IsoProjection(layout.originX, layout.originY, layout.tileWidth, layout.tileHeight);
    this.aiLayoutKey = key;
  }

  private drawDivider(): void {
    const g = this.dividerG;
    g.clear();
    const x = Math.round(CANVAS.width / 2);
    g.lineStyle(1, 0x45475a, 0.7);
    g.beginPath();
    g.moveTo(x, HUD_TOP_H);
    g.lineTo(x, CANVAS.height - HUD_BOT_H);
    g.strokePath();
  }

  private setupCameraInput(): void {
    const cam = this.cameras.main;
    this.input.addPointer(2);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x > CANVAS.width / 2) return; // zone IA — ignorer
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
        this.prevPinchMidX = 0;
        this.prevPinchMidY = 0;
      }
    });

    // Pinch trackpad (ctrlKey) → zoom ; deux doigts scroll → pan.
    this.input.on('wheel', (p: Phaser.Input.Pointer, _go: unknown, dx: number, dy: number) => {
      const native = p.event as WheelEvent;
      if (native.ctrlKey) {
        const factor = dy > 0 ? 1 / 1.1 : 1.1;
        const newZoom = Phaser.Math.Clamp(cam.zoom * factor, 0.2, 5);
        const world = cam.getWorldPoint(p.x, p.y);
        cam.zoom = newZoom;
        const worldAfter = cam.getWorldPoint(p.x, p.y);
        cam.scrollX += world.x - worldAfter.x;
        cam.scrollY += world.y - worldAfter.y;
      } else {
        cam.scrollX += dx / cam.zoom;
        cam.scrollY += dy / cam.zoom;
      }
    });
  }

  private handlePinch(): void {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const cam = this.cameras.main;

      if (this.prevPinchDist > 0 && dist > 0) {
        const worldMid = cam.getWorldPoint(this.prevPinchMidX, this.prevPinchMidY);
        const newZoom = Phaser.Math.Clamp(cam.zoom * (dist / this.prevPinchDist), 0.2, 5);
        cam.zoom = newZoom;
        cam.scrollX = worldMid.x - midX / newZoom;
        cam.scrollY = worldMid.y - midY / newZoom;
      }

      this.prevPinchDist = dist;
      this.prevPinchMidX = midX;
      this.prevPinchMidY = midY;
      this.isPanning = true;
    } else {
      this.prevPinchDist = 0;
      this.prevPinchMidX = 0;
      this.prevPinchMidY = 0;
    }
  }

  private updateHoveredTile(): void {
    const ptr = this.input.activePointer;
    if (ptr.x > CANVAS.width / 2) {
      this.hoveredTile = null;
      return;
    }
    const world = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const pos = this.projection.screenToTile(world.x, world.y);
    const { rows, cols } = this.state.office;
    this.hoveredTile =
      pos.row >= 0 && pos.row < rows && pos.col >= 0 && pos.col < cols ? pos : null;
  }

  override update(_time: number, deltaMs: number): void {
    this.handlePinch();
    this.ensureProjection();
    this.ensureAiProjection();
    this.updateHoveredTile();

    if (this.raceWinner === null && !this.state.paused && !this.state.gameOver) {
      this.accumulator += deltaMs;
      this.aiDecideTimer += deltaMs;

      const stepMs = BALANCE.simulation.fixedStepMs;
      let guard = 0;
      while (this.accumulator >= stepMs && guard < 10) {
        tick(this.state, stepMs / 1000, BALANCE);
        if (!this.aiState.gameOver) tick(this.aiState, stepMs / 1000, BALANCE);
        this.accumulator -= stepMs;
        guard++;
        if (this.state.gameOver) break;
      }

      // Décision IA : une fois par seconde.
      if (this.aiDecideTimer >= 1000 && !this.aiState.gameOver) {
        this.aiDecideTimer -= 1000;
        aiDecide(this.aiState, BALANCE);
      }
    }

    // Vérification de la condition de victoire.
    const WIN = BALANCE.competition.winClients;
    if (this.raceWinner === null && !this.state.gameOver) {
      if (this.state.clients.length >= WIN) {
        this.raceWinner = 'player';
        this.hud.showRaceResult('player', this.state, this.aiState);
      } else if (this.aiState.clients.length >= WIN) {
        this.raceWinner = 'ai';
        this.hud.showRaceResult('ai', this.state, this.aiState);
      }
    }

    // Synchronisation des renderers.
    this.board.sync(this.state, this.projection, this.hoveredTile);
    this.zones.sync(this.state, this.projection);
    this.employeesR.sync(this.state, this.projection, this.controller.selectedEmployeeId);
    this.hud.sync(this.state, this.aiState);

    this.aiBoard.sync(this.aiState, this.aiProjection, null);
    this.aiZones.sync(this.aiState, this.aiProjection);
    this.aiEmployeesR.sync(this.aiState, this.aiProjection, null);
  }
}
