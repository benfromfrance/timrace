import type { ControlSource } from './Controls';
import { GamepadSource } from './GamepadSource';
import { KeyboardSource } from './KeyboardSource';

export const MAX_PLAYERS = 2;

/**
 * Détecte les manettes et attribue une source d'entrée à chaque joueur.
 * Un joueur rejoint en appuyant sur A (ou Espace / Entrée au clavier).
 *
 * Singleton partagé entre les scènes : les attributions survivent aux changements de scène.
 */
class InputManagerImpl {
  /** slots[0] = joueur 1, slots[1] = joueur 2 */
  readonly slots: (ControlSource | null)[] = Array(MAX_PLAYERS).fill(null);
  private readonly pads = new Map<number, GamepadSource>();
  private readonly keyboards = [new KeyboardSource('left'), new KeyboardSource('right')];
  private readonly listeners = new Set<() => void>();
  private lastFrame = -1;

  constructor() {
    window.addEventListener('gamepadconnected', (e) => {
      console.info('[input] manette connectée', e.gamepad.index, e.gamepad.id, e.gamepad.mapping);
      this.pads.set(e.gamepad.index, new GamepadSource(e.gamepad.index, e.gamepad.id));
      this.emit();
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      console.info('[input] manette déconnectée', e.gamepad.index);
      const pad = this.pads.get(e.gamepad.index);
      this.pads.delete(e.gamepad.index);
      const slot = this.slots.findIndex((s) => s === pad);
      if (slot >= 0) this.slots[slot] = null;
      this.emit();
    });
  }

  /**
   * Appelé par chaque scène active ; ne lit les manettes qu'une fois par frame,
   * sinon le 2e appel effacerait les `*Pressed` détectés par le 1er.
   */
  update(frame: number): void {
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    for (const pad of this.pads.values()) pad.poll();
    for (const kb of this.keyboards) kb.poll();
  }

  /** Une manette ou un clavier, attribué ou non, vérifie-t-il la condition ? */
  any(test: (s: ControlSource) => boolean): boolean {
    return [...this.pads.values(), ...this.keyboards].some(test);
  }

  /** Les sources pas encore attribuées dont le joueur vient d'appuyer sur A. */
  pollJoinRequests(): ControlSource[] {
    const free = [...this.pads.values(), ...this.keyboards].filter((s) => !this.slots.includes(s));
    return free.filter((s) => s.state.actionPressed);
  }

  join(source: ControlSource): number {
    const slot = this.slots.indexOf(null);
    if (slot >= 0) {
      this.slots[slot] = source;
      source.rumble(0.4, 150);
      this.emit();
    }
    return slot;
  }

  leave(slot: number): void {
    this.slots[slot] = null;
    this.emit();
  }

  get connectedPadCount(): number {
    return this.pads.size;
  }

  get joinedCount(): number {
    return this.slots.filter((s) => s !== null).length;
  }

  /** Les `count` premiers emplacements sont-ils toujours occupés ? (détecte une manette débranchée) */
  hasPlayers(count: number): boolean {
    return this.slots.slice(0, count).every((s) => s !== null);
  }

  /** Regroupe les joueurs dans les premiers emplacements : un joueur seul devient J1. */
  compact(): void {
    const joined = this.slots.filter((s) => s !== null);
    this.slots.fill(null);
    joined.forEach((s, i) => (this.slots[i] = s));
    this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}

export const Input = new InputManagerImpl();
