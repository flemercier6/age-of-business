/**
 * Types de base partagés par toute la LOGIQUE.
 * La logique ne parle qu'en coordonnées grille cartésiennes (row/col).
 * Aucune notion de pixel/écran ici (ni ailleurs dans core/).
 */

/** Position dans la grille : row = ligne, col = colonne. */
export interface GridPos {
  row: number;
  col: number;
}

/** Les 3 types de zones de département de la V1. */
export type ZoneType = 'engineering' | 'marketing' | 'sales';

/** Niveaux de bureau de la V1. */
export type OfficeLevel = 'garage' | 'office';

export function posEquals(a: GridPos, b: GridPos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function posKey(p: GridPos): string {
  return `${p.row},${p.col}`;
}
