import type { Balance } from '../config/balance';
import { applyCommand } from './commands';
import type { GameState } from './gamestate';
import { population } from './selectors';
import type { GridPos } from './types';

function nextEmptyCell(s: GameState): GridPos | null {
  for (let row = 0; row < s.office.rows; row++) {
    for (let col = 0; col < s.office.cols; col++) {
      if (!s.zones.find((z) => z.pos.row === row && z.pos.col === col)) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * Prend des décisions autonomes pour l'adversaire IA.
 * Appelée à intervalle régulier dans la boucle de jeu.
 * Utilise applyCommand() comme le joueur — sur l'état exclusif de l'IA.
 */
export function aiDecide(s: GameState, b: Balance): void {
  if (s.gameOver) return;

  const cash = s.resources.cash;
  const tech = Math.floor(s.resources.tech);
  const engZones = s.zones.filter((z) => z.type === 'engineering');
  const salesZones = s.zones.filter((z) => z.type === 'sales');
  const mktZones = s.zones.filter((z) => z.type === 'marketing');

  // 1. Lancer le MVP SaaS dès que possible (préféré : lancement rapide à 30 TECH).
  if (!s.flags.mvpLaunched) {
    if (tech >= b.product.mvpSaaS.techCost && cash >= b.product.mvpSaaS.cashCost) {
      applyCommand(s, { kind: 'launchMvp', mvpType: 'saas' }, b);
      return;
    }
  }

  // 2. Affecter les employés libres aux zones prêtes.
  const readyEmpty = s.zones.filter(
    (z) => z.buildSecondsRemaining === 0 && z.assignedEmployeeId === null,
  );
  if (readyEmpty.length > 0) {
    const freeEmp = s.employees.find((e) => e.assignedZoneId === null);
    if (freeEmp) {
      applyCommand(s, { kind: 'assign', employeeId: freeEmp.id, pos: readyEmpty[0].pos }, b);
      return;
    }
    if (population(s) < s.office.populationCap) {
      const zone = readyEmpty[0];
      if (cash >= b.profiles.manager.cashCost) {
        applyCommand(s, { kind: 'recruit', profile: 'manager', zoneId: zone.id }, b);
        return;
      }
      if (cash >= b.profiles.stagiaire.cashCost) {
        applyCommand(s, { kind: 'recruit', profile: 'stagiaire', zoneId: zone.id }, b);
        return;
      }
    }
  }

  // 3. Déménager au bureau (accès à 25 zones) dès que le MVP est lancé et le cash suffisant.
  if (s.office.level === 'garage' && s.flags.mvpLaunched && cash >= b.offices.relocateCost) {
    applyCommand(s, { kind: 'relocate' }, b);
    return;
  }

  // 4. Construire des zones (avec une réserve pour recruter ensuite).
  const pos = nextEmptyCell(s);
  if (!pos) return;
  const buf = b.profiles.stagiaire.cashCost; // 150 $ de réserve minimum

  // Engineering en premier : source de TECH pour le MVP.
  if (engZones.length === 0 && cash >= b.zones.engineering.buildCost + buf) {
    applyCommand(s, { kind: 'buildZone', pos, zoneType: 'engineering' }, b);
    return;
  }

  // Premier Sales : clients après le MVP.
  if (salesZones.length === 0 && engZones.length >= 1 && cash >= b.zones.sales.buildCost + buf) {
    applyCommand(s, { kind: 'buildZone', pos, zoneType: 'sales' }, b);
    return;
  }

  // Deuxième Engineering pour accélérer la TECH avant le MVP.
  if (
    !s.flags.mvpLaunched &&
    engZones.length < 2 &&
    salesZones.length >= 1 &&
    cash >= b.zones.engineering.buildCost + buf
  ) {
    applyCommand(s, { kind: 'buildZone', pos, zoneType: 'engineering' }, b);
    return;
  }

  // Marketing (BRAND → multiplicateur Sales) après le MVP.
  if (s.flags.mvpLaunched && mktZones.length === 0 && cash >= b.zones.marketing.buildCost + buf) {
    applyCommand(s, { kind: 'buildZone', pos, zoneType: 'marketing' }, b);
    return;
  }

  // Plus de Sales pour accélérer l'acquisition de clients.
  if (s.flags.mvpLaunched && salesZones.length < 10 && cash >= b.zones.sales.buildCost + buf) {
    applyCommand(s, { kind: 'buildZone', pos, zoneType: 'sales' }, b);
    return;
  }
}
