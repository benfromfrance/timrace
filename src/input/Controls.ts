/**
 * Ce que le jeu lit pour un joueur, quelle que soit la source (manette ou clavier).
 * Les champs `*Pressed` et `nav*` ne sont actifs que sur la frame où le bouton est enfoncé.
 */
export interface ControlState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  /** Navigation dans les menus : -1 / 1 sur la frame où le stick ou la croix est poussé. */
  navX: number;
  navY: number;
  action: boolean; // bouton A maintenu
  actionPressed: boolean;
  fire: boolean; // bouton X (ou RB / RT) maintenu
  firePressed: boolean;
  powerPressed: boolean; // bouton Y (ou LB)
  backPressed: boolean; // bouton B
  startPressed: boolean; // bouton Menu (☰)
}

export interface ControlSource {
  readonly id: string;
  readonly label: string;
  /** Appelé une fois par frame avant lecture de `state`. */
  poll(): void;
  readonly state: ControlState;
  rumble(intensity?: number, durationMs?: number): void;
}

export const emptyState = (): ControlState => ({
  moveX: 0,
  moveY: 0,
  navX: 0,
  navY: 0,
  action: false,
  actionPressed: false,
  fire: false,
  firePressed: false,
  powerPressed: false,
  backPressed: false,
  startPressed: false,
});

const NAV_THRESHOLD = 0.6;
const axisDir = (v: number) => (v > NAV_THRESHOLD ? 1 : v < -NAV_THRESHOLD ? -1 : 0);

/** Déduit navX/navY de moveX/moveY ; `prev` garde la direction de la frame précédente. */
export function updateNav(state: ControlState, prev: { x: number; y: number }) {
  const x = axisDir(state.moveX);
  const y = axisDir(state.moveY);
  state.navX = x !== prev.x ? x : 0;
  state.navY = y !== prev.y ? y : 0;
  prev.x = x;
  prev.y = y;
}
