import type { ZoneType } from '../core/types';

/**
 * Constantes PUREMENT visuelles (couleurs, tailles, mise en page écran).
 * Volontairement séparées de balance.ts : ici rien n'influe sur le gameplay.
 */

export const CANVAS = { width: 760, height: 760 };

export const LAYOUT = {
  /** Marge autour de la grille (px). */
  margin: 36,
  /** Taille maximale d'une case (px) pour éviter une grille géante au Garage. */
  maxTile: 150,
  /** Hauteur réservée en bas du canvas pour le "banc" des employés libres. */
  benchHeight: 130,
  /** Espace entre le bas de la grille et le banc. */
  benchTop: 26,
  /** Diamètre nominal d'un emplacement du banc. */
  benchSlot: 50,
  benchGap: 16,
};

export const COLORS = {
  background: 0x11111b,
  gridLine: 0x45475a,
  cellEmpty: 0x1e1e2e,
  zone: {
    engineering: 0x89b4fa, // bleu
    marketing: 0xf9e2af, // jaune
    sales: 0xa6e3a1, // vert
  } as Record<ZoneType, number>,
  employeeUnassigned: 0xbac2de, // gris neutre (recrues)
  cofounder: 0xcba6f7, // mauve — couleur distinctive des 2 cofounders
  selectionRing: 0xf38ba8,
  dotOutline: 0x11111b,
  textLight: '#cdd6f4',
  zoneInactiveAlpha: 0.25,
  zoneActiveAlpha: 0.9,
  benchLabel: '#9399b2',
};

export const ZONE_LETTER: Record<ZoneType, string> = {
  engineering: 'E',
  marketing: 'M',
  sales: 'S',
};

/**
 * Calcule la mise en page écran de la grille pour des dimensions données.
 * La case s'adapte pour que Garage (2x2) ET Bureau (5x5) tiennent dans le canvas.
 */
export function computeBoardLayout(rows: number, cols: number) {
  const availW = CANVAS.width - LAYOUT.margin * 2;
  const availH = CANVAS.height - LAYOUT.benchHeight - LAYOUT.margin * 2;
  const tile = Math.floor(Math.min(LAYOUT.maxTile, availW / cols, availH / rows));
  const gridW = tile * cols;
  const gridH = tile * rows;
  const originX = Math.round((CANVAS.width - gridW) / 2);
  const originY = LAYOUT.margin;
  return { tile, originX, originY, gridW, gridH };
}
