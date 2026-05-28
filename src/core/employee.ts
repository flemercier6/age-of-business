import type { EmployeeProfile } from './types';

/**
 * Un employé (cofounder ou recrue). En V1 tous sont POLYVALENTS :
 * assignables à n'importe quel type de zone.
 * assignedZoneId === null => non assigné (sur le "banc").
 */
export interface Employee {
  id: number;
  salaryPerSec: number;
  /** Multiplicateur appliqué à la production de la zone assignée. */
  productionMultiplier: number;
  /** Profil de recrutement ou 'cofounder' pour les fondateurs de départ. */
  profile: EmployeeProfile | 'cofounder';
  assignedZoneId: number | null;
  /** Vrai pour les 2 cofounders de départ (couleur distinctive au rendu). */
  isCofounder: boolean;
}

export function createEmployee(
  id: number,
  salaryPerSec: number,
  isCofounder = false,
  productionMultiplier = 1.0,
  profile: EmployeeProfile | 'cofounder' = 'cofounder',
): Employee {
  return { id, salaryPerSec, productionMultiplier, profile, assignedZoneId: null, isCofounder };
}
