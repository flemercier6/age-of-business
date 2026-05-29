import type { Balance } from '../config/balance';
import type { Command } from '../core/commands';
import type { Employee } from '../core/employee';
import type { GameState } from '../core/gamestate';
import {
  burnRate,
  canLaunchMvp,
  isBrandDecaying,
  netCashPerSec,
  population,
  revenuePerSec,
  secondsToNextPayment,
  secondsToNextPayroll,
} from '../core/selectors';
import type { EmployeeProfile, GridPos, ZoneType } from '../core/types';
import type { Zone } from '../core/zone';

/**
 * HUD en overlay HTML/DOM (au-dessus du canvas Phaser).
 * Lit l'état en lecture seule via sync() ; émet des Command via dispatch().
 * Aucune règle de gameplay ici : les boutons ne font qu'envoyer des ordres.
 */
export class Hud {
  private statusEl: HTMLElement;
  private overlayEl: HTMLElement;

  private btnMvp!: HTMLButtonElement;
  private btnRelocate!: HTMLButtonElement;

  private buildPos: GridPos | null = null;
  private buildMenuOpen = false;
  private zoneMenuZoneId: number | null = null;
  private gameOverShown = false;

  private flashMsg = '';
  private flashUntil = 0;

  /** Dernier état synchronisé — utilisé par les menus pour vérifier l'affordabilité. */
  private lastState: GameState | null = null;

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

    const win = this.balance.competition.winClients;
    top.innerHTML = `
      ${this.stat('CASH', 'v-cash')}
      ${this.stat('TECH', 'v-tech')}
      ${this.stat('BRAND', 'v-brand')}
      ${this.stat('CLIENTS', 'v-clients')}
      ${this.stat('ESPACE', 'v-space')}
      ${this.stat('BURN /s', 'v-burn')}
      ${this.stat('REVENU /s', 'v-rev')}
      ${this.stat('SURVIE', 'v-time')}
      ${this.stat(`COURSE → ${win}`, 'v-race')}
    `;

    controls.innerHTML = `
      <button id="btn-mvp"></button>
      <button id="btn-relocate"></button>
      <span class="hint">ESPACE = pause · clic département = recruter · clic employé puis zone = réassigner</span>
    `;
    this.btnMvp = document.getElementById('btn-mvp') as HTMLButtonElement;
    this.btnRelocate = document.getElementById('btn-relocate') as HTMLButtonElement;

    this.btnMvp.addEventListener('click', () => this.openMvpModal());
    this.btnRelocate.addEventListener('click', () => this.dispatch({ kind: 'relocate' }));
  }

  private stat(label: string, id: string): string {
    return `<div class="stat"><span class="label">${label}</span><span class="value" id="${id}">–</span></div>`;
  }

  flash(message: string): void {
    this.flashMsg = message;
    this.flashUntil = performance.now() + 2500;
  }

  isMenuOpen(): boolean {
    return this.overlayEl.classList.contains('active');
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
        this.closeOverlay();
      });
    });
    document.getElementById('build-cancel')?.addEventListener('click', () => this.closeOverlay());
    this.overlayEl.classList.add('active');
  }

  private buildOption(zone: ZoneType, label: string, cost: number): string {
    const cls = zone === 'engineering' ? 'zone-eng' : zone === 'marketing' ? 'zone-mkt' : 'zone-sales';
    return `<button class="${cls}" data-zone="${zone}">${label}<span class="cost">${cost} $</span></button>`;
  }

  /** Ouvre le menu de recrutement / gestion d'une zone cliquée. */
  openZoneMenu(zone: Zone, occupant: Employee | undefined): void {
    if (this.gameOverShown) return;
    this.zoneMenuZoneId = zone.id;
    const s = this.lastState;
    const b = this.balance;
    const zoneLabel = this.zoneTypeLabel(zone.type);

    if (occupant) {
      this.renderOccupiedZoneMenu(zone, occupant, zoneLabel);
    } else {
      this.renderRecruitMenu(zone, zoneLabel, s, b);
    }
  }

  private renderRecruitMenu(zone: Zone, zoneLabel: string, s: GameState | null, b: Balance): void {
    const popFull = s ? population(s) >= s.office.populationCap : false;
    const cash = s?.resources.cash ?? 0;
    const brand = s?.resources.brand ?? 0;

    const p = b.profiles;

    const stagiaireCantAfford = cash < p.stagiaire.cashCost;
    const managerCantAfford = cash < p.manager.cashCost;
    const headOfCantAfford = cash < p.headOf.cashCost || brand < p.headOf.brandCost;

    this.overlayEl.innerHTML = `
      <div class="modal">
        <h2>${zoneLabel} · Recruter</h2>
        <p>Zone vide — choisissez un profil :</p>
        <div class="options">
          <button class="profile-stagiaire" data-profile="stagiaire"
            ${popFull || stagiaireCantAfford ? 'disabled' : ''}>
            <strong>Stagiaire</strong> <span class="profile-mult">×0.5</span>
            <br><small>Production à demi-vitesse</small>
            <span class="cost">${p.stagiaire.cashCost} $</span>
          </button>
          <button class="profile-manager" data-profile="manager"
            ${popFull || managerCantAfford ? 'disabled' : ''}>
            <strong>Manager</strong> <span class="profile-mult">×1.0</span>
            <br><small>Production nominale</small>
            <span class="cost">${p.manager.cashCost} $</span>
          </button>
          <button class="profile-headof" data-profile="headOf"
            ${popFull || headOfCantAfford ? 'disabled' : ''}>
            <strong>Head of</strong> <span class="profile-mult">×2.0</span>
            <br><small>Double production — requiert de la BRAND</small>
            <span class="cost">${p.headOf.cashCost} $ + ${p.headOf.brandCost} ◆</span>
          </button>
          ${popFull ? '<p class="warn-inline">Plafond de population atteint</p>' : ''}
          <button id="zone-cancel">Annuler</button>
        </div>
      </div>
    `;

    this.overlayEl.querySelectorAll<HTMLButtonElement>('button[data-profile]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const profile = btn.dataset.profile as EmployeeProfile;
        if (this.zoneMenuZoneId !== null) {
          this.dispatch({ kind: 'recruit', profile, zoneId: this.zoneMenuZoneId });
        }
        this.closeOverlay();
      });
    });
    document.getElementById('zone-cancel')?.addEventListener('click', () => this.closeOverlay());
    this.overlayEl.classList.add('active');
  }

  private renderOccupiedZoneMenu(zone: Zone, occupant: Employee, zoneLabel: string): void {
    const profileLabel = this.profileLabel(occupant.profile);
    const mult = occupant.productionMultiplier;
    this.overlayEl.innerHTML = `
      <div class="modal">
        <h2>${zoneLabel} · ${profileLabel}</h2>
        <p>Production ×${mult}${occupant.salaryPerSec > 0 ? ` · Salaire ${occupant.salaryPerSec} $/s` : ''}</p>
        <div class="options">
          <button id="zone-free">Libérer l'employé → banc</button>
          <button id="zone-cancel">Annuler</button>
        </div>
      </div>
    `;
    document.getElementById('zone-free')?.addEventListener('click', () => {
      this.dispatch({ kind: 'unassign', employeeId: occupant.id });
      this.closeOverlay();
    });
    document.getElementById('zone-cancel')?.addEventListener('click', () => this.closeOverlay());
    this.overlayEl.classList.add('active');
  }

  openMvpModal(): void {
    if (this.gameOverShown || !this.lastState) return;
    const s = this.lastState;
    const b = this.balance;
    const saas = b.product.mvpSaaS;
    const ai = b.product.mvpAI;
    const tech = Math.floor(s.resources.tech);
    const cash = Math.floor(s.resources.cash);

    const canSaaS = tech >= saas.techCost && cash >= saas.cashCost;
    const canAI = tech >= ai.techCost && cash >= ai.cashCost;

    this.overlayEl.innerHTML = `
      <div class="modal">
        <h2>Lancer le MVP</h2>
        <p>Choisissez votre stratégie produit :</p>
        <div class="options">
          <button id="mvp-saas" ${canSaaS ? '' : 'disabled'}>
            <strong>MVP SaaS</strong>
            <br><small>Revenu ${saas.revenuePerPayment} $ / versement client</small>
            <span class="cost">${saas.techCost} TECH + ${saas.cashCost} $</span>
          </button>
          <button id="mvp-ai" ${canAI ? '' : 'disabled'}>
            <strong>MVP AI</strong>
            <br><small>Revenu ${ai.revenuePerPayment} $ / versement client</small>
            <span class="cost">${ai.techCost} TECH + ${ai.cashCost} $</span>
          </button>
          <button id="mvp-cancel">Annuler</button>
        </div>
      </div>
    `;
    document.getElementById('mvp-saas')?.addEventListener('click', () => {
      this.dispatch({ kind: 'launchMvp', mvpType: 'saas' });
      this.closeOverlay();
    });
    document.getElementById('mvp-ai')?.addEventListener('click', () => {
      this.dispatch({ kind: 'launchMvp', mvpType: 'ai' });
      this.closeOverlay();
    });
    document.getElementById('mvp-cancel')?.addEventListener('click', () => this.closeOverlay());
    this.overlayEl.classList.add('active');
  }

  closeBuildMenu(): void {
    this.closeOverlay();
  }

  closeOverlay(): void {
    this.buildMenuOpen = false;
    this.zoneMenuZoneId = null;
    this.buildPos = null;
    this.overlayEl.innerHTML = '';
    this.overlayEl.classList.remove('active');
  }

  sync(s: GameState, aiState?: GameState): void {
    this.lastState = s;
    const b = this.balance;
    const net = netCashPerSec(s, b);
    const rev = revenuePerSec(s, b);
    const burn = burnRate(s);

    // CASH avec indicateur de tendance (net positif/négatif).
    const cashEl = this.value('v-cash');
    cashEl.textContent = `${Math.floor(s.resources.cash)} $ ${net >= 0 ? '▲' : '▼'}`;
    cashEl.className = `value ${net >= 0 ? 'good' : 'bad'}`;

    // TECH avec indication MVP.
    const techEl = this.value('v-tech');
    if (s.flags.mvpLaunched) {
      techEl.textContent = `${Math.floor(s.resources.tech)} ✓MVP`;
      techEl.className = 'value good';
    } else {
      techEl.textContent = `${Math.floor(s.resources.tech)}`;
      techEl.className = 'value';
    }

    // BRAND avec alerte de decay.
    const brandEl = this.value('v-brand');
    const decaying = isBrandDecaying(s);
    brandEl.textContent = `${s.resources.brand.toFixed(1)}${decaying ? ' ↓' : ''}`;
    brandEl.className = `value ${decaying ? 'warn' : ''}`;

    this.value('v-clients').textContent = `${s.clients.length}`;

    const pop = population(s);
    const spaceEl = this.value('v-space');
    spaceEl.textContent = `${pop}/${s.office.populationCap}`;
    spaceEl.className = `value ${pop >= s.office.populationCap ? 'warn' : ''}`;

    this.value('v-burn').textContent = `${burn.toFixed(0)} $`;
    this.value('v-rev').textContent = `${rev.toFixed(1)} $`;
    this.value('v-time').textContent = this.formatTime(s.elapsedSec);

    // Course — score des deux parties.
    const raceEl = this.value('v-race');
    if (aiState) {
      const winning = s.clients.length > aiState.clients.length;
      const losing = s.clients.length < aiState.clients.length;
      raceEl.textContent = `TU ${s.clients.length} · IA ${aiState.clients.length}`;
      raceEl.className = `value ${winning ? 'good' : losing ? 'bad' : ''}`;
    }

    // Boutons.
    const blocked = s.paused || s.gameOver;

    if (s.flags.mvpLaunched) {
      this.btnMvp.innerHTML = 'MVP lancé ✓';
      this.btnMvp.disabled = true;
    } else {
      this.btnMvp.innerHTML = 'Lancer le MVP';
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
      const nextPay = Math.ceil(secondsToNextPayment(s, b));
      const salaryTotal = s.employees.reduce((sum, e) => sum + e.salaryPerSec, 0) * b.payroll.cycleSec;
      if (salaryTotal > 0) {
        const nextSal = Math.ceil(secondsToNextPayroll(s, b));
        if (nextSal <= nextPay) {
          this.statusEl.textContent = `Paie dans ${nextSal}s (−${salaryTotal} $) · Clients dans ${nextPay}s (+${s.clients.length * s.mvpRevenuePerPayment} $)`;
          this.statusEl.style.color = salaryTotal > s.resources.cash ? 'var(--bad)' : 'var(--warn)';
        } else {
          this.statusEl.textContent = `Prochain versement clients dans ${nextPay}s (+${s.clients.length * s.mvpRevenuePerPayment} $)`;
          this.statusEl.style.color = 'var(--good)';
        }
      } else {
        this.statusEl.textContent = `Prochain versement clients dans ${nextPay}s (+${s.clients.length * s.mvpRevenuePerPayment} $)`;
        this.statusEl.style.color = 'var(--good)';
      }
    } else {
      this.statusEl.textContent = '';
    }

    if (s.gameOver && !this.gameOverShown) this.showGameOver(s);
  }

  showRaceResult(winner: 'player' | 'ai', playerState: GameState, aiState: GameState): void {
    this.gameOverShown = true;
    this.closeOverlay();
    const won = winner === 'player';
    const win = this.balance.competition.winClients;
    this.overlayEl.innerHTML = `
      <div class="modal ${won ? 'win' : 'gameover'}">
        <h2>${won ? 'VICTOIRE !' : 'DÉFAITE'}</h2>
        <p>${won
          ? `Vous avez atteint ${win} clients avant le concurrent !`
          : `Le concurrent vous a devancé avec ${win} clients.`
        }</p>
        <p>Vous : ${playerState.clients.length} clients actifs · ${this.formatTime(playerState.elapsedSec)}</p>
        <p>Concurrent : ${aiState.clients.length} clients actifs</p>
        <div class="options">
          <button id="restart">Rejouer</button>
        </div>
      </div>
    `;
    document.getElementById('restart')?.addEventListener('click', () => location.reload());
    this.overlayEl.classList.add('active');
  }

  private showGameOver(s: GameState): void {
    this.gameOverShown = true;
    this.closeOverlay();
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
    this.overlayEl.classList.add('active');
  }

  private zoneTypeLabel(type: ZoneType): string {
    return type === 'engineering' ? 'Engineering' : type === 'marketing' ? 'Marketing' : 'Sales';
  }

  private profileLabel(profile: EmployeeProfile | 'cofounder'): string {
    const labels: Record<string, string> = {
      cofounder: 'Cofounder',
      stagiaire: 'Stagiaire',
      manager: 'Manager',
      headOf: 'Head of',
    };
    return labels[profile] ?? profile;
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
