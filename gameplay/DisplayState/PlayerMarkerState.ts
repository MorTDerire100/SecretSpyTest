import { PlayerID } from "../World/PlayerID";

export class PlayerMarkerState {
  playerID: PlayerID;

  // How many moves has it been since this marker was this player's location (0 == location is fully known)
  age: number;

  // A given player always has a reveal age of 0 for themselves (since they know their own location),
  // this flag indicates if they are actually in cover (i.e. location is not known to the other player)
  // and should use the undercover pin instead of the revealed pin to display on the map
  isUndercover: boolean;

  constructor(playerID: PlayerID, age: number, isUndercover: boolean) {
    this.playerID = playerID;
    this.age = age;
    this.isUndercover = isUndercover;
  }
}
