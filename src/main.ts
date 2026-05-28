import Phaser from 'phaser';
import './styles.css';
import { GameScene } from './render/GameScene';
import { CANVAS, COLORS } from './render/theme';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CANVAS.width,
  height: CANVAS.height,
  backgroundColor: COLORS.background,
  scene: [GameScene],
  render: { pixelArt: false, antialias: true },
});
