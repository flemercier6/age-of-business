import type { GridPos, ZoneType } from './types';

/**
 * Une ZONE occupe exactement 1 case et a une capacité de 1 employé.
 * Elle est d'abord "en construction" (buildSecondsRemaining > 0) pendant
 * buildTotalSec secondes, puis devient active.
 */
export interface Zone {
  id: number;
  pos: GridPos;
  type: ZoneType;
  assignedEmployeeId: number | null;
  /** Secondes restantes avant la fin de la construction (0 = opérationnelle). */
  buildSecondsRemaining: number;
  /** Durée totale de construction, pour calculer la progression [0–1]. */
  buildTotalSec: number;
}

/** buildTimeSec = 0 pour les zones déjà construites (état initial). */
export function createZone(id: number, pos: GridPos, type: ZoneType, buildTimeSec = 0): Zone {
  return {
    id,
    pos,
    type,
    assignedEmployeeId: null,
    buildSecondsRemaining: buildTimeSec,
    buildTotalSec: buildTimeSec,
  };
}
