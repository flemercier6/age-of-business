/**
 * Un employé (cofounder ou recrue). En V1 tous sont POLYVALENTS :
 * assignables à n'importe quel type de zone.
 * assignedZoneId === null => non assigné (sur le "banc").
 */
export interface Employee {
  id: number;
  salaryPerSec: number;
  assignedZoneId: number | null;
  /** Vrai pour les 2 cofounders de départ (couleur distinctive au rendu). */
  isCofounder: boolean;
}

export function createEmployee(
  id: number,
  salaryPerSec: number,
  isCofounder = false,
): Employee {
  return { id, salaryPerSec, assignedZoneId: null, isCofounder };
}
