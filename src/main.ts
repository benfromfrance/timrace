import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { PodiumScene } from './scenes/PodiumScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MatchSetupScene } from './scenes/MatchSetupScene';
import { ChallengesScene } from './scenes/ChallengesScene';

new Phaser.Game({
  type: Phaser.AUTO, // WebGL, repli sur Canvas
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0d0f1a',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, LobbyScene, ChallengesScene, CharacterSelectScene, MatchSetupScene, GameScene, PodiumScene],
});
