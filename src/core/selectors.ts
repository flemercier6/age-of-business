import type { Balance } from '../config/balance';
import type { Employee } from './employee';
import type { GameState } from './gamestate';
import { posEquals, type GridPos } from './types';
import type { Zone } from './zone';

/** Burn rate = somme des salaires/sec (assignés ou non). */
export function burnRate(s: GameState): number {
  return s.employees.reduce((sum, e) => sum + e.salaryPerSec, 0);
}

/** Coût CASH/sec des zones Marketing actuellement actives. */
export function marketingCashCostPerSec(s: GameState, b: Balance): number {
  const active = s.zones.filter((z) => z.type === 'marketing' && z.assignedEmployeeId !== null);
  return active.length * b.zones.marketing.cashCostPerSec;
}

/** Nombre de clients actifs. */
export function clientCount(s: GameState): number {
  return s.clients.length;
}

/**
 * Revenu CASH/sec MOYEN issu des clients. Le revenu réel est pulsé (un
 * versement toutes les billingCycleSec) ; on en donne la moyenne pour l'UI
 * et le calcul du net.
 */
export function revenuePerSec(s: GameState, b: Balance): number {
  return (s.clients.length * b.revenue.cashPerPayment) / b.revenue.billingCycleSec;
}

/** Secondes restantes avant le prochain versement des clients. */
export function secondsToNextPayment(s: GameState, b: Balance): number {
  return Math.max(0, b.revenue.billingCycleSec - s.billingTimerSec);
}

/** Secondes restantes avant la prochaine pulsation de paie. */
export function secondsToNextPayroll(s: GameState, b: Balance): number {
  return Math.max(0, b.payroll.cycleSec - s.payrollTimerSec);
}

/** Variation nette de CASH/sec moyenne (revenu - salaires - coût marketing). */
export function netCashPerSec(s: GameState, b: Balance): number {
  return revenuePerSec(s, b) - burnRate(s) - marketingCashCostPerSec(s, b);
}

export function zoneAt(s: GameState, pos: GridPos): Zone | undefined {
  return s.zones.find((z) => posEquals(z.pos, pos));
}

/** L'employé assigné à la zone située sur cette case (ou undefined). */
export function employeeAt(s: GameState, pos: GridPos): Employee | undefined {
  const zone = zoneAt(s, pos);
  if (!zone || zone.assignedEmployeeId === null) return undefined;
  return s.employees.find((e) => e.id === zone.assignedEmployeeId);
}

export function population(s: GameState): number {
  return s.employees.length;
}

export function unassignedEmployees(s: GameState): Employee[] {
  return s.employees.filter((e) => e.assignedZoneId === null);
}

/** Vrai si au moins une zone Marketing est active (produit de la Brand). */
export function isMarketingActive(s: GameState): boolean {
  return s.zones.some((z) => z.type === 'marketing' && z.assignedEmployeeId !== null);
}

/** Vrai si la Brand décroît actuellement (alerte visuelle). */
export function isBrandDecaying(s: GameState): boolean {
  return !isMarketingActive(s) && s.resources.brand > 0;
}

export function canLaunchMvp(s: GameState, b: Balance): boolean {
  return !s.flags.mvpLaunched && s.resources.tech >= b.product.mvpTechThreshold;
}

export function canRelocate(s: GameState, b: Balance): boolean {
  return s.office.level === 'garage' && s.resources.cash >= b.offices.relocateCost;
}
