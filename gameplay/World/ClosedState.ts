export enum ClosedState {
  open,
  warning,
  justClosed, // was closed on this turn
  closedLastTurn, // was closed on the previous turn
  closed,
  fromBeginning,
}

// Indicates whether a player could possibly be in location with this closed state, even if it is closed (i.e. it is open, or has closed recently)
export function canBeIn(state: ClosedState): boolean {
  switch (state) {
    case ClosedState.open:
    case ClosedState.warning:
    case ClosedState.justClosed:
    case ClosedState.closedLastTurn:
      return true;
    case ClosedState.closed:
    case ClosedState.fromBeginning:
      return false;
  }
}

// Indicates whether a player is allowed to enter a location with this close state (i.e. the city is NOT closed)
export function canEnter(state: ClosedState): boolean {
  switch (state) {
    case ClosedState.open:
    case ClosedState.warning:
      return true;
    case ClosedState.justClosed:
    case ClosedState.closedLastTurn:
    case ClosedState.closed:
    case ClosedState.fromBeginning:
      return false;
  }
}
