import type { GridPos, ZoneType } from './types';

/**
 * Une ZONE occupe exactement 1 case et a une capacité de 1 employé.
 * Elle ne "fonctionne" (produit) que si assignedEmployeeId !== null.
 */
export interface Zone {
  id: number;
  pos: GridPos;
  type: ZoneType;
  assignedEmployeeId: number | null;
}

export function createZone(id: number, pos: GridPos, type: ZoneType): Zone {
  return { id, pos, type, assignedEmployeeId: null };
}
