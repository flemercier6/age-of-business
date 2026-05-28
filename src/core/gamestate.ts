import type { Balance } from '../config/balance';
import type { Client } from './client';
import { createEmployee, type Employee } from './employee';
import { createOffice, type Office } from './office';
import type { Resources } from './resources';
import { createZone, type Zone } from './zone';

export interface Flags {
  mvpLaunched: boolean;
}

/**
 * État complet du monde. Données pures (sérialisables), aucune référence
 * à Phaser ni aux pixels. Le rendu lit cet état ; les commandes le mutent.
 */
export interface GameState {
  office: Office;
  zones: Zone[];
  employees: Employee[];
  /** Clients actifs (entités individuelles avec versements restants). */
  clients: Client[];
  resources: Resources;
  flags: Flags;
  /** Progression fractionnaire vers le prochain client acquis (Sales). */
  clientAccrual: number;
  /** Temps écoulé dans le cycle de facturation courant (secondes). */
  billingTimerSec: number;
  /** Temps écoulé depuis la dernière pulsation de paie (secondes). */
  payrollTimerSec: number;
  /** Temps de survie écoulé (secondes). */
  elapsedSec: number;
  /** Pause d'observation : la simulation s'arrête, aucun ordre accepté. */
  paused: boolean;
  gameOver: boolean;
  gameOverReason: string | null;
  /** Compteurs d'identifiants. */
  nextZoneId: number;
  nextEmployeeId: number;
  nextClientId: number;
}

export function createInitialState(balance: Balance): GameState {
  const office = createOffice('garage', balance);

  const employees: Employee[] = [];
  for (let i = 0; i < balance.start.cofounders; i++) {
    // Les employés de départ sont des cofounders (couleur distinctive).
    employees.push(createEmployee(i + 1, balance.employee.salaryPerSec, true, 1.0, 'cofounder'));
  }

  const startZone = createZone(
    1,
    { ...balance.start.initialEngineeringZone },
    'engineering',
  );

  return {
    office,
    zones: [startZone],
    employees,
    clients: [],
    resources: { cash: balance.resources.startingCash, tech: 0, brand: 0 },
    flags: { mvpLaunched: false },
    clientAccrual: 0,
    billingTimerSec: 0,
    payrollTimerSec: 0,
    elapsedSec: 0,
    paused: false,
    gameOver: false,
    gameOverReason: null,
    nextZoneId: 2,
    nextEmployeeId: balance.start.cofounders + 1,
    nextClientId: 1,
  };
}
