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
  shadow: 0x000000,
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
 * Calcule la mise en page écran de la grille ISOMÉTRIQUE pour des dimensions
 * données. Le losange est en ratio 2:1 (largeur = 2 × hauteur). La boîte
 * englobante de la grille mesure :
 *   W = (rows + cols) × tileWidth / 2
 *   H = (rows + cols) × tileHeight / 2
 * On dimensionne la case pour que Garage ET Bureau tiennent dans le canvas,
 * puis on centre la grille horizontalement et verticalement.
 */
export function computeBoardLayout(rows: number, cols: number) {
  const availW = CANVAS.width - LAYOUT.margin * 2;
  const availH = CANVAS.height - LAYOUT.benchHeight - LAYOUT.margin * 2;
  const span = rows + cols;

  // tileWidth = 2 × tileHeight ⇒ W = span × tileHeight, H = span × tileHeight / 2.
  const thByWidth = availW / span; // contrainte largeur
  const thByHeight = (availH * 2) / span; // contrainte hauteur
  const tileHeight = Math.max(16, Math.floor(Math.min(LAYOUT.maxTile / 2, thByWidth, thByHeight)));
  const tileWidth = tileHeight * 2;

  const hw = tileWidth / 2;
  const hh = tileHeight / 2;
  const gridW = span * hw;
  const gridH = span * hh;

  // Origine = centre du losange (0,0). On centre la boîte englobante :
  // - son bord gauche est à originX − rows × hw ;
  // - son bord haut  est à originY − hh.
  const originX = Math.round((CANVAS.width - gridW) / 2 + rows * hw);
  const topMargin = LAYOUT.margin + Math.max(0, (availH - gridH) / 2);
  const originY = Math.round(topMargin + hh);

  return { tileWidth, tileHeight, originX, originY, gridW, gridH };
}
