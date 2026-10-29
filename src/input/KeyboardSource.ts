import { type ControlSource, type ControlState, emptyState, updateNav } from './Controls';

export interface KeyLayout {
  up: string;
  down: string;
  left: string;
  right: string;
  action: string;
  fire: string;
  power: string;
  back: string;
  start: string;
}

/** Codes `KeyboardEvent.code` : indépendants de la disposition (AZERTY/QWERTY). */
export const KEYBOARD_LAYOUTS: Record<'left' | 'right', KeyLayout> = {
  // Physiquement ZQSD sur AZERTY
  left: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'Space', fire: 'KeyF', power: 'KeyG', back: 'KeyE', start: 'KeyR' },
  right: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Enter', fire: 'ShiftRight', power: 'Period', back: 'Escape', start: 'Backspace' },
};

const held = new Set<string>();
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('keydown', (e) => held.add(e.code));
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

/** Clavier de secours : pratique pour développer sans manette branchée. */
export class KeyboardSource implements ControlSource {
  readonly id: string;
  readonly label: string;
  readonly state: ControlState = emptyState();
  private prev = { action: false, fire: false, power: false, back: false, start: false };
  private readonly prevNav = { x: 0, y: 0 };

  constructor(side: 'left' | 'right', private readonly keys: KeyLayout = KEYBOARD_LAYOUTS[side]) {
    listen();
    this.id = `kb:${side}`;
    this.label = side === 'left' ? 'Clavier gauche (ZQSD)' : 'Clavier droit (flèches)';
  }

  poll(): void {
    const k = this.keys;
    const action = held.has(k.action);
    const fire = held.has(k.fire);
    const power = held.has(k.power);
    const back = held.has(k.back);
    const start = held.has(k.start);
    this.state.moveX = (held.has(k.right) ? 1 : 0) - (held.has(k.left) ? 1 : 0);
    this.state.moveY = (held.has(k.down) ? 1 : 0) - (held.has(k.up) ? 1 : 0);
    this.state.action = action;
    this.state.actionPressed = action && !this.prev.action;
    this.state.fire = fire;
    this.state.firePressed = fire && !this.prev.fire;
    this.state.powerPressed = power && !this.prev.power;
    this.state.backPressed = back && !this.prev.back;
    this.state.startPressed = start && !this.prev.start;
    this.prev = { action, fire, power, back, start };
    updateNav(this.state, this.prevNav);
  }

  rumble(): void {}
}
