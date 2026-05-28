import { defineConfig } from 'vite';

export default defineConfig({
  // Base relative : les assets sont chargés en chemin relatif, ce qui permet de
  // servir le jeu depuis un sous-chemin (GitHub Pages : /<repo>/) sans config.
  base: './',
  server: { open: true },
});
