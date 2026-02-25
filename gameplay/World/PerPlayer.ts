import { PlayerID } from "./PlayerID";

export class PerPlayer<T> {
  private storage: [T, T];

  constructor(player0: T, player1: T) {
    this.storage = [player0, player1];
  }

  get(index: PlayerID): T {
    switch (index) {
      case PlayerID.player0:
        return this.storage[0];
      case PlayerID.player1:
        return this.storage[1];
    }
  }

  set(index: PlayerID, newValue: T): void {
    switch (index) {
      case PlayerID.player0:
        this.storage[0] = newValue;
        break;
      case PlayerID.player1:
        this.storage[1] = newValue;
        break;
    }
  }
}
