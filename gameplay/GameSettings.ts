import { PerPlayer } from "./World/PerPlayer";
import { Loadout } from "./World/Loadout";
import { Action } from "./World/Action";
import { PlayerID, otherPlayer } from "./World/PlayerID";
import { SpiesMap } from "../blocks/types";
import { isMatchCompleted } from "../webview/utils";

export enum SeedType {
  random,
  custom,
}

export class CustomSeedType {
  type: SeedType.custom;
  value: number;

  constructor(value: number) {
    this.type = SeedType.custom;
    this.value = value;
  }
}

export type SeedTypeUnion = SeedType.random | CustomSeedType;

export class GameSettings {
  loadout: PerPlayer<Loadout> = new PerPlayer<Loadout>(new Loadout(), new Loadout());
  name: PerPlayer<string> = new PerPlayer<string>("Player 0", "Player 1");
  isBot: PerPlayer<boolean> = new PerPlayer<boolean>(false, false);

  mapStructure: SpiesMap = {
    codename: "Dummy Map",
    name: "Dummy Map",
    id: "dummy",
    description: "A dummy map for initialization",
    bonus: [],
    cities: [],
    cxns: [],
    critical: [],
  };

  playerNames: PerPlayer<string> = new PerPlayer<string>("Player 0", "Player 1");

  worldSeed: SeedTypeUnion = SeedType.random;

  closeCities: boolean = true;
  initialIntel: PerPlayer<number> = new PerPlayer<number>(0, 0);
  isRanked: boolean = false;
  isTutorial: boolean = false;
  matchHistory: (PlayerID | null)[];

  constructor(seriesLength: number = 5) {
    this.matchHistory = new Array(seriesLength).fill(null);
  }

  abilityCosts: Record<Action, number> = {
    [Action.deepCover]: 20,
    [Action.reveal]: 10,
    [Action.rapid]: 40,
    [Action.prepareMission]: 40,
    [Action.encryption]: 25,
    [Action.interrogate]: 0,
    [Action.unlockStrikeReports]: 10,
  } as Record<Action, number>;

  private intelForWinsBehind(wins: number): number {
    if (wins <= 0) {
      return 0;
    } else if (wins === 1) {
      return 10;
    } else if (wins === 2) {
      return 20;
    } else {
      return 30;
    }
  }

  autobalance(): void {
    const winCount0 = this.matchHistory.filter((w) => w === PlayerID.player0).length;
    const winCount1 = this.matchHistory.filter((w) => w === PlayerID.player1).length;
    const winDifferential = winCount0 - winCount1;
    this.initialIntel.set(PlayerID.player0, this.intelForWinsBehind(-winDifferential));
    this.initialIntel.set(PlayerID.player1, this.intelForWinsBehind(winDifferential));
  }

  initialTurnPlayer(): PlayerID {
    // Find the most recent winner (last non-null entry)
    for (let i = this.matchHistory.length - 1; i >= 0; i--) {
      const winner = this.matchHistory[i];
      if (winner !== null) {
        return otherPlayer(winner);
      }
    }
    // Fall back to player0 if no winner found
    return PlayerID.player0;
  }

  recordWin(winner: PlayerID): void {
    if (this.matchHistory === undefined) {
      // matchCompeleted handles managing wins/losses if there's no match history, so just move on.
      return;
    }

    // Find the first null slot in the matchHistory array and record the winner
    const firstNullIndex = this.matchHistory.findIndex((win) => win === null);
    if (firstNullIndex !== -1) {
      this.matchHistory[firstNullIndex] = winner;
    }
  }

  recordPlayerConceded(playerID: PlayerID): void {
    // Fill all remaining null slots with the conceding player's ID
    const otherPlayerID = playerID === PlayerID.player0 ? PlayerID.player1 : PlayerID.player0;

    if (this.matchHistory === undefined) {
      return;
    }

    for (let i = 0; i < this.matchHistory.length; i++) {
      if (this.matchHistory[i] === null) {
        this.matchHistory[i] = otherPlayerID;
      }
    }
  }

  isMatchComplete(): boolean {
    return isMatchCompleted(this.matchHistory);
  }
}
