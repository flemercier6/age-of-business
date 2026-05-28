import type { Balance } from '../config/balance';
import type { Command } from '../core/commands';
import type { GameState } from '../core/gamestate';
import {
  burnRate,
  canLaunchMvp,
  isBrandDecaying,
  netCashPerSec,
  population,
  revenuePerSec,
  secondsToNextPayment,
} from '../core/selectors';
import type { GridPos, ZoneType } from '../core/types';

/**
 * HUD en overlay HTML/DOM (au-dessus du canvas Phaser).
 * Lit l'état en lecture seule via sync() ; émet des Command via dispatch().
 * Aucune règle de gameplay ici : les boutons ne font qu'envoyer des ordres.
 */
export class Hud {
  private statusEl: HTMLElement;
  private overlayEl: HTMLElement;

  private btnRecruit!: HTMLButtonElement;
  private btnMvp!: HTMLButtonElement;
  private btnRelocate!: HTMLButtonElement;

  private buildPos: GridPos | null = null;
  private buildMenuOpen = false;
  private gameOverShown = false;

  private flashMsg = '';
  private flashUntil = 0;

  constructor(
    private dispatch: (cmd: Command) => void,
    private balance: Balance,
  ) {
    const top = document.getElementById('hud-top')!;
    const controls = document.getElementById('controls')!;
    this.overlayEl = document.getElementById('overlay')!;

    // Barre de statut (pause / messages), insérée juste après la barre du haut.
    this.statusEl = document.createElement('div');
    this.statusEl.id = 'hud-status';
    top.insertAdjacentElement('afterend', this.statusEl);

    top.innerHTML = `
      ${this.stat('CASH', 'v-cash')}
      ${this.stat('TECH', 'v-tech')}
      ${this.stat('BRAND', 'v-brand')}
      ${this.stat('CLIENTS', 'v-clients')}
      ${this.stat('ESPACE', 'v-space')}
      ${this.stat('BURN /s', 'v-burn')}
      ${this.stat('REVENU /s', 'v-rev')}
      ${this.stat('SURVIE', 'v-time')}
    `;

    controls.innerHTML = `
      <button id="btn-recruit"></button>
      <button id="btn-mvp"></button>
      <button id="btn-relocate"></button>
      <span class="hint">ESPACE = pause · clic employé puis zone = assigner · clic banc = libérer</span>
    `;
    this.btnRecruit = document.getElementById('btn-recruit') as HTMLButtonElement;
    this.btnMvp = document.getElementById('btn-mvp') as HTMLButtonElement;
    this.btnRelocate = document.getElementById('btn-relocate') as HTMLButtonElement;

    this.btnRecruit.addEventListener('click', () => this.dispatch({ kind: 'recruit' }));
    this.btnMvp.addEventListener('click', () => this.dispatch({ kind: 'launchMvp' }));
    this.btnRelocate.addEventListener('click', () => this.dispatch({ kind: 'relocate' }));
  }

  private stat(label: string, id: string): string {
    return `<div class="stat"><span class="label">${label}</span><span class="value" id="${id}">–</span></div>`;
  }

  flash(message: string): void {
    this.flashMsg = message;
    this.flashUntil = performance.now() + 2500;
  }

  openBuildMenu(pos: GridPos): void {
    if (this.gameOverShown) return;
    this.buildPos = pos;
    this.buildMenuOpen = true;
    const z = this.balance.zones;
    this.overlayEl.innerHTML = `
      <div class="modal">
        <h2>Construire une zone</h2>
        <p>Case (ligne ${pos.row}, col ${pos.col})</p>
        <div class="options">
          ${this.buildOption('engineering', 'Engineering — produit de la TECH', z.engineering.buildCost)}
          ${this.buildOption('marketing', 'Marketing — produit de la BRAND (coûte du CASH)', z.marketing.buildCost)}
          ${this.buildOption('sales', 'Sales — acquiert des CLIENTS (requiert le MVP)', z.sales.buildCost)}
          <button id="build-cancel">Annuler</button>
        </div>
      </div>
    `;
    this.overlayEl.querySelectorAll<HTMLButtonElement>('button[data-zone]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const zoneType = btn.dataset.zone as ZoneType;
        if (this.buildPos) this.dispatch({ kind: 'buildZone', pos: this.buildPos, zoneType });
        this.closeBuildMenu();
      });
    });
    document.getElementById('build-cancel')?.addEventListener('click', () => this.closeBuildMenu());
  }

  private buildOption(zone: ZoneType, label: string, cost: number): string {
    const cls = zone === 'engineering' ? 'zone-eng' : zone === 'marketing' ? 'zone-mkt' : 'zone-sales';
    return `<button class="${cls}" data-zone="${zone}">${label}<span class="cost">${cost} $</span></button>`;
  }

  closeBuildMenu(): void {
    if (!this.buildMenuOpen) return;
    this.buildMenuOpen = false;
    this.buildPos = null;
    this.overlayEl.innerHTML = '';
  }

  sync(s: GameState): void {
    const b = this.balance;
    const net = netCashPerSec(s, b);
    const rev = revenuePerSec(s, b);
    const burn = burnRate(s);

    // CASH avec indicateur de tendance (net positif/négatif).
    const cashEl = this.value('v-cash');
    cashEl.textContent = `${Math.floor(s.resources.cash)} $ ${net >= 0 ? '▲' : '▼'}`;
    cashEl.className = `value ${net >= 0 ? 'good' : 'bad'}`;

    // TECH avec progression vers le MVP.
    const techEl = this.value('v-tech');
    if (s.flags.mvpLaunched) {
      techEl.textContent = `${Math.floor(s.resources.tech)} ✓MVP`;
      techEl.className = 'value good';
    } else {
      techEl.textContent = `${Math.floor(s.resources.tech)} / ${b.product.mvpTechThreshold}`;
      techEl.className = 'value';
    }

    // BRAND avec alerte de decay.
    const brandEl = this.value('v-brand');
    const decaying = isBrandDecaying(s);
    brandEl.textContent = `${Math.floor(s.resources.brand)}${decaying ? ' ↓' : ''}`;
    brandEl.className = `value ${decaying ? 'warn' : ''}`;

    this.value('v-clients').textContent = `${s.clients.length}`;

    const pop = population(s);
    const spaceEl = this.value('v-space');
    spaceEl.textContent = `${pop}/${s.office.populationCap}`;
    spaceEl.className = `value ${pop >= s.office.populationCap ? 'warn' : ''}`;

    this.value('v-burn').textContent = `${burn.toFixed(0)} $`;
    this.value('v-rev').textContent = `${rev.toFixed(1)} $`;
    this.value('v-time').textContent = this.formatTime(s.elapsedSec);

    // Boutons.
    const blocked = s.paused || s.gameOver;

    this.btnRecruit.textContent = '';
    this.btnRecruit.innerHTML = `Recruter <span class="cost">${b.employee.recruitCost} $</span>`;
    this.btnRecruit.disabled =
      blocked || pop >= s.office.populationCap || s.resources.cash < b.employee.recruitCost;

    if (s.flags.mvpLaunched) {
      this.btnMvp.innerHTML = 'MVP lancé ✓';
      this.btnMvp.disabled = true;
    } else {
      this.btnMvp.innerHTML = `Lancer le MVP <span class="cost">${b.product.mvpTechThreshold} TECH</span>`;
      this.btnMvp.disabled = blocked || !canLaunchMvp(s, b);
    }

    if (s.office.level !== 'garage') {
      this.btnRelocate.innerHTML = 'Bureau ✓';
      this.btnRelocate.disabled = true;
    } else {
      this.btnRelocate.innerHTML = `Déménager <span class="cost">${b.offices.relocateCost} $</span>`;
      this.btnRelocate.disabled = blocked || s.resources.cash < b.offices.relocateCost;
    }

    // Statut : pause > message flash > rien.
    if (s.paused && !s.gameOver) {
      this.statusEl.textContent = '⏸ PAUSE — observation seule (ESPACE pour reprendre)';
      this.statusEl.style.color = 'var(--accent)';
    } else if (performance.now() < this.flashUntil) {
      this.statusEl.textContent = `⚠ ${this.flashMsg}`;
      this.statusEl.style.color = 'var(--bad)';
    } else if (s.clients.length > 0) {
      const next = Math.ceil(secondsToNextPayment(s, b));
      this.statusEl.textContent = `Prochain versement clients dans ${next}s (+${s.clients.length * b.revenue.cashPerPayment} $)`;
      this.statusEl.style.color = 'var(--good)';
    } else {
      this.statusEl.textContent = '';
    }

    if (s.gameOver && !this.gameOverShown) this.showGameOver(s);
  }

  private showGameOver(s: GameState): void {
    this.gameOverShown = true;
    this.buildMenuOpen = false;
    this.overlayEl.innerHTML = `
      <div class="modal gameover">
        <h2>${s.gameOverReason ?? 'Game over'}</h2>
        <p>Vous avez survécu ${this.formatTime(s.elapsedSec)} · ${s.clients.length} clients actifs à la fin.</p>
        <div class="options">
          <button id="restart">Rejouer</button>
        </div>
      </div>
    `;
    document.getElementById('restart')?.addEventListener('click', () => location.reload());
  }

  private value(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private formatTime(sec: number): string {
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
