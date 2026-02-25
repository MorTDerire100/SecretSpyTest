import { PlayerID } from "./PlayerID";
import { Action } from "./Action";

export class Move {
  playerID: PlayerID;
  cityID: string | null;
  action: Action;
  turnNo: number | null;
  moveNo: number | null;

  constructor(
    pid: PlayerID,
    cid: string | null,
    act: Action,
    turnNo: number | null = null,
    moveNo: number | null = null
  ) {
    this.playerID = pid;
    this.cityID = cid;
    this.action = act;
    this.turnNo = turnNo;
    this.moveNo = moveNo;
  }

  get debugDescription(): string {
    let cityName = "@";
    if (this.cityID) {
      cityName = String(this.cityID);
    }

    if (this.turnNo !== null && this.moveNo !== null) {
      return `Move: city1-${cityName}, act-${this.action}, p-${this.playerID}, turn-${this.turnNo}, move-${this.moveNo}`;
    } else {
      return `Move: city1-${cityName}, act-${this.action}, p-${this.playerID}`;
    }
  }

  get description(): string {
    if (this.cityID) {
      return `${this.action} to ${this.cityID}`;
    } else {
      return `${this.action}`;
    }
  }
}
