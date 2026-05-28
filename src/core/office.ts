import type { Balance } from '../config/balance';
import type { GridPos, OfficeLevel } from './types';

/**
 * Le bureau définit la taille de la grille ET le plafond de population.
 * (Données pures en row/col — aucune dépendance au rendu.)
 */
export interface Office {
  level: OfficeLevel;
  rows: number;
  cols: number;
  /** Plafond de population = nombre max d'employés (vient du bureau). */
  populationCap: number;
}

export function createOffice(level: OfficeLevel, balance: Balance): Office {
  const spec = balance.offices[level];
  return {
    level,
    rows: spec.rows,
    cols: spec.cols,
    populationCap: spec.populationCap,
  };
}

export function inBounds(office: Office, pos: GridPos): boolean {
  return pos.row >= 0 && pos.col >= 0 && pos.row < office.rows && pos.col < office.cols;
}
