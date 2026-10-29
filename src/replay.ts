import Phaser from 'phaser';

/** Durée enregistrée pour le replay de fin de partie. */
export const REPLAY_WINDOW_MS = 3000;

/** Un objet affiché à un instant donné : image (sprite) ou texte (emoji, libellé flottant). */
export interface Ghost {
  key?: string;
  text?: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  tint: number;
  fill: boolean;
  flipX: boolean;
  fontSize?: string;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
}

export interface ReplayFrame {
  t: number;
  ghosts: Ghost[];
}

/** Le moment fort sur lequel zoomer et ralentir. */
export interface KeyMoment {
  t: number;
  x: number;
  y: number;
}

/** Profondeur à partir de laquelle un objet fait partie de l'interface (non rejoué). */
const HUD_DEPTH = 20;

/**
 * Garde les REPLAY_WINDOW_MS dernières millisecondes de la scène, image par image.
 * Seuls les sprites et les textes du jeu sont capturés : l'arène (formes fixes) reste affichée telle quelle.
 */
export class ReplayRecorder {
  frames: ReplayFrame[] = [];

  record(scene: Phaser.Scene, t: number) {
    const ghosts: Ghost[] = [];
    for (const obj of scene.children.list) {
      if (obj instanceof Phaser.GameObjects.Text) {
        if (!obj.visible || obj.alpha < 0.02 || obj.depth >= HUD_DEPTH) continue;
        ghosts.push({
          ...this.transform(obj),
          text: obj.text,
          tint: 0xffffff,
          fill: false,
          flipX: false,
          fontSize: String(obj.style.fontSize),
          color: String(obj.style.color),
          stroke: String(obj.style.stroke),
          strokeThickness: obj.style.strokeThickness,
        });
      } else if (obj instanceof Phaser.GameObjects.Image) {
        if (!obj.visible || !obj.active || obj.alpha < 0.02 || obj.depth >= HUD_DEPTH) continue;
        ghosts.push({
          ...this.transform(obj),
          key: obj.texture.key,
          tint: obj.tintTopLeft,
          fill: obj.tintMode === Phaser.TintModes.FILL,
          flipX: obj.flipX,
        });
      }
    }
    this.frames.push({ t, ghosts });
    while (this.frames.length > 1 && this.frames[0].t < t - REPLAY_WINDOW_MS) this.frames.shift();
  }

  private transform(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text) {
    return { x: obj.x, y: obj.y, rotation: obj.rotation, scaleX: obj.scaleX, scaleY: obj.scaleY, alpha: obj.alpha };
  }
}
