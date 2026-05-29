import type { Balance } from '../config/balance';
import { createEmployee } from './employee';
import type { GameState } from './gamestate';
import { inBounds } from './office';
import { population, zoneAt } from './selectors';
import type { EmployeeProfile, GridPos, ZoneType } from './types';
import { createZone } from './zone';

/**
 * Intentions du joueur (pattern Command). Tous les ordres passent par
 * applyCommand() : un SEUL point d'entrée qui valide et applique. C'est aussi
 * là qu'est centralisée la règle "aucun ordre pendant la pause".
 */
export type Command =
  | { kind: 'buildZone'; pos: GridPos; zoneType: ZoneType }
  | { kind: 'assign'; employeeId: number; pos: GridPos }
  | { kind: 'unassign'; employeeId: number }
  | { kind: 'recruit'; profile: EmployeeProfile; zoneId: number }
  | { kind: 'launchMvp'; mvpType: 'saas' | 'ai' }
  | { kind: 'relocate' };

export interface CommandResult {
  ok: boolean;
  reason?: string;
}

const fail = (reason: string): CommandResult => ({ ok: false, reason });
const ok = (): CommandResult => ({ ok: true });

export function applyCommand(s: GameState, cmd: Command, b: Balance): CommandResult {
  if (s.gameOver) return fail('Partie terminée');
  if (s.paused) return fail('En pause — aucun ordre possible');

  switch (cmd.kind) {
    case 'buildZone':
      return buildZone(s, cmd.pos, cmd.zoneType, b);
    case 'assign':
      return assign(s, cmd.employeeId, cmd.pos);
    case 'unassign':
      return unassign(s, cmd.employeeId);
    case 'recruit':
      return recruit(s, cmd.profile, cmd.zoneId, b);
    case 'launchMvp':
      return launchMvp(s, cmd.mvpType, b);
    case 'relocate':
      return relocate(s, b);
  }
}

function buildZone(s: GameState, pos: GridPos, type: ZoneType, b: Balance): CommandResult {
  if (!inBounds(s.office, pos)) return fail('Hors de la grille');
  if (zoneAt(s, pos)) return fail('Case déjà occupée');
  const cost = b.zones[type].buildCost;
  if (s.resources.cash < cost) return fail('CASH insuffisant');
  s.resources.cash -= cost;
  s.zones.push(createZone(s.nextZoneId++, { ...pos }, type, b.zones[type].buildTimeSec));
  return ok();
}

function assign(s: GameState, employeeId: number, pos: GridPos): CommandResult {
  const emp = s.employees.find((e) => e.id === employeeId);
  if (!emp) return fail('Employé introuvable');
  const zone = zoneAt(s, pos);
  if (!zone) return fail('Aucune zone ici');
  if (zone.buildSecondsRemaining > 0) return fail('Zone en construction');
  if (zone.assignedEmployeeId !== null && zone.assignedEmployeeId !== emp.id) {
    return fail('Zone déjà occupée');
  }
  // Libère l'ancienne zone de l'employé (réaffectation).
  if (emp.assignedZoneId !== null) {
    const old = s.zones.find((z) => z.id === emp.assignedZoneId);
    if (old) old.assignedEmployeeId = null;
  }
  emp.assignedZoneId = zone.id;
  zone.assignedEmployeeId = emp.id;
  return ok();
}

function unassign(s: GameState, employeeId: number): CommandResult {
  const emp = s.employees.find((e) => e.id === employeeId);
  if (!emp) return fail('Employé introuvable');
  if (emp.assignedZoneId === null) return fail('Employé déjà libre');
  const zone = s.zones.find((z) => z.id === emp.assignedZoneId);
  if (zone) zone.assignedEmployeeId = null;
  emp.assignedZoneId = null;
  return ok();
}

function recruit(s: GameState, profile: EmployeeProfile, zoneId: number, b: Balance): CommandResult {
  if (population(s) >= s.office.populationCap) return fail('Plafond de population atteint');

  const zone = s.zones.find((z) => z.id === zoneId);
  if (!zone) return fail('Zone introuvable');
  if (zone.buildSecondsRemaining > 0) return fail('Zone en construction');
  if (zone.assignedEmployeeId !== null) return fail('Zone déjà occupée');

  const cfg = b.profiles[profile];
  if (s.resources.cash < cfg.cashCost) return fail('CASH insuffisant');
  if (s.resources.brand < cfg.brandCost) return fail('BRAND insuffisante');

  s.resources.cash -= cfg.cashCost;
  s.resources.brand -= cfg.brandCost;

  const emp = createEmployee(s.nextEmployeeId++, cfg.salaryPerSec, false, cfg.productionMultiplier, profile);
  s.employees.push(emp);

  emp.assignedZoneId = zone.id;
  zone.assignedEmployeeId = emp.id;

  return ok();
}

function launchMvp(s: GameState, mvpType: 'saas' | 'ai', b: Balance): CommandResult {
  if (s.flags.mvpLaunched) return fail('MVP déjà lancé');
  const cfg = mvpType === 'saas' ? b.product.mvpSaaS : b.product.mvpAI;
  if (s.resources.tech < cfg.techCost) return fail('TECH insuffisante');
  if (s.resources.cash < cfg.cashCost) return fail('CASH insuffisant');
  s.resources.tech -= cfg.techCost;
  s.resources.cash -= cfg.cashCost;
  s.flags.mvpLaunched = true;
  s.mvpRevenuePerPayment = cfg.revenuePerPayment;
  return ok();
}

function relocate(s: GameState, b: Balance): CommandResult {
  if (s.office.level !== 'garage') return fail('Déjà au niveau maximum');
  if (s.resources.cash < b.offices.relocateCost) return fail('CASH insuffisant');
  s.resources.cash -= b.offices.relocateCost;
  const next = b.offices.office;
  // Les zones déjà placées sont conservées (la grille s'agrandit autour).
  s.office = {
    level: 'office',
    rows: next.rows,
    cols: next.cols,
    populationCap: next.populationCap,
  };
  return ok();
}
