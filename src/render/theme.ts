import type { ZoneType } from '../core/types';

/**
 * Constantes PUREMENT visuelles (couleurs, tailles, mise en page écran).
 * Volontairement séparées de balance.ts : ici rien n'influe sur le gameplay.
 */

const vw = typeof window !== 'undefined' ? window.innerWidth : 760;
const vh = typeof window !== 'undefined' ? window.innerHeight : 760;

/** Le canvas Phaser occupe tout le viewport. */
export const CANVAS = { width: vw, height: vh };

/** Hauteur de la barre HUD + status en haut (overlay HTML fixe). */
export const HUD_TOP_H = 80;
/** Hauteur du footer de contrôles en bas (overlay HTML fixe). */
export const HUD_BOT_H = 72;

const ref = Math.min(760, Math.min(vw, vh));
const r = ref / 760;

export const LAYOUT = {
  margin: Math.max(8, Math.round(20 * r)),
  maxTile: Math.max(40, Math.round(150 * r)),
  benchHeight: Math.max(60, Math.round(110 * r)),
  benchTop: Math.max(4, Math.round(16 * r)),
  benchSlot: Math.max(20, Math.round(46 * r)),
  benchGap: Math.max(2, Math.round(12 * r)),
};

export const COLORS = {
  background: 0x11111b,
  gridLine: 0x45475a,
  cellEmpty: 0x1e1e2e,
  cellHover: 0x2a2a40,
  zone: {
    engineering: 0x89b4fa,
    marketing: 0xf9e2af,
    sales: 0xa6e3a1,
  } as Record<ZoneType, number>,
  employeeUnassigned: 0xbac2de,
  cofounder: 0xcba6f7,
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
 * Calcule la mise en page initiale de la grille ISOMÉTRIQUE dans l'espace monde.
 * Le losange est en ratio 2:1 (tileWidth = 2 × tileHeight).
 * La grille est centrée entre le HUD du haut et le footer du bas.
 */
export function computeBoardLayout(rows: number, cols: number) {
  const availW = CANVAS.width - LAYOUT.margin * 2;
  const availH = CANVAS.height - HUD_TOP_H - HUD_BOT_H - LAYOUT.margin * 2;
  const span = rows + cols;

  const thByWidth = availW / span;
  const thByHeight = (availH * 2) / span;
  const tileHeight = Math.max(16, Math.floor(Math.min(LAYOUT.maxTile / 2, thByWidth, thByHeight)));
  const tileWidth = tileHeight * 2;

  const hw = tileWidth / 2;
  const hh = tileHeight / 2;
  const gridW = span * hw;
  const gridH = span * hh;

  const originX = Math.round((CANVAS.width - gridW) / 2 + rows * hw);
  const topMargin = HUD_TOP_H + LAYOUT.margin + Math.max(0, (availH - gridH) / 2);
  const originY = Math.round(topMargin + hh);

  return { tileWidth, tileHeight, originX, originY, gridW, gridH };
}
