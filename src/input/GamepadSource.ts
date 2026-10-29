import { type ControlSource, type ControlState, emptyState, updateNav } from './Controls';

/**
 * Indices du "standard mapping" W3C — c'est celui qu'exposent les manettes Xbox
 * (filaire, Bluetooth ou adaptateur sans fil) sur Chrome, Edge, Firefox et Safari.
 * https://w3c.github.io/gamepad/#remapping
 */
export const XboxButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  View: 8,
  Menu: 9,
  LeftStick: 10,
  RightStick: 11,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
  Xbox: 16,
} as const;

const DEADZONE = 0.2;

export class GamepadSource implements ControlSource {
  readonly id: string;
  readonly label: string;
  readonly state: ControlState = emptyState();
  private prev = { a: false, b: false, menu: false, fire: false, power: false };
  private readonly prevNav = { x: 0, y: 0 };

  constructor(readonly index: number, name: string) {
    this.id = `pad:${index}`;
    this.label = GamepadSource.prettyName(name, index);
  }

  private get pad(): Gamepad | null {
    return navigator.getGamepads()[this.index] ?? null;
  }

  get connected(): boolean {
    return this.pad?.connected ?? false;
  }

  poll(): void {
    const pad = this.pad;
    if (!pad) {
      Object.assign(this.state, emptyState());
      return;
    }
    const btn = (i: number) => pad.buttons[i]?.pressed ?? false;

    let x = applyDeadzone(pad.axes[0] ?? 0);
    let y = applyDeadzone(pad.axes[1] ?? 0);
    // La croix directionnelle prend le relais si le stick est au repos
    if (x === 0 && y === 0) {
      x = (btn(XboxButton.DpadRight) ? 1 : 0) - (btn(XboxButton.DpadLeft) ? 1 : 0);
      y = (btn(XboxButton.DpadDown) ? 1 : 0) - (btn(XboxButton.DpadUp) ? 1 : 0);
    }

    const a = btn(XboxButton.A);
    const b = btn(XboxButton.B);
    const menu = btn(XboxButton.Menu);
    const fire = btn(XboxButton.X) || btn(XboxButton.RB) || btn(XboxButton.RT);
    const power = btn(XboxButton.Y) || btn(XboxButton.LB);

    this.state.moveX = x;
    this.state.moveY = y;
    this.state.action = a;
    this.state.actionPressed = a && !this.prev.a;
    this.state.fire = fire;
    this.state.firePressed = fire && !this.prev.fire;
    this.state.powerPressed = power && !this.prev.power;
    this.state.backPressed = b && !this.prev.b;
    this.state.startPressed = menu && !this.prev.menu;
    this.prev = { a, b, menu, fire, power };
    updateNav(this.state, this.prevNav);
  }

  rumble(intensity = 0.6, durationMs = 120): void {
    // Supporté par Chrome/Edge (et Firefox récent) sur les manettes Xbox
    this.pad?.vibrationActuator?.playEffect('dual-rumble', {
      duration: durationMs,
      strongMagnitude: intensity,
      weakMagnitude: intensity,
    }).catch(() => {});
  }

  private static prettyName(name: string, index: number): string {
    if (/xbox|xinput|045e/i.test(name)) return `Manette Xbox #${index + 1}`;
    return `Manette #${index + 1}`;
  }
}

function applyDeadzone(v: number): number {
  if (Math.abs(v) < DEADZONE) return 0;
  // Re-étalonne pour que la sortie reparte de 0 juste après la zone morte
  return Math.sign(v) * ((Math.abs(v) - DEADZONE) / (1 - DEADZONE));
}
