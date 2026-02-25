export enum UnlockIndicatorState {
  unlocked,
  locked,
  unknown,
}

export function showTitle(state: UnlockIndicatorState): boolean {
  switch (state) {
    case UnlockIndicatorState.locked:
      return false;
    case UnlockIndicatorState.unknown:
    case UnlockIndicatorState.unlocked:
      return true;
  }
}

export function alpha(state: UnlockIndicatorState): number {
  switch (state) {
    case UnlockIndicatorState.locked:
    case UnlockIndicatorState.unknown:
      return 0.3;
    case UnlockIndicatorState.unlocked:
      return 1.0;
  }
}

export enum UnlockVisibility {
  visiblyLocked,
  visiblyUnlocked,
  secretlyUnlocked,
  secretlyLocked,
}

export function fromUnlockVisibility(unlockVisibility: UnlockVisibility): UnlockIndicatorState {
  switch (unlockVisibility) {
    case UnlockVisibility.visiblyLocked:
      return UnlockIndicatorState.locked;
    case UnlockVisibility.visiblyUnlocked:
      return UnlockIndicatorState.unlocked;
    case UnlockVisibility.secretlyUnlocked:
    case UnlockVisibility.secretlyLocked:
      return UnlockIndicatorState.unknown;
  }
}
