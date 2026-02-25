import { Simulation } from "./Simulation/Simulation";
import { Action } from "./World/Action";
import { otherPlayer, PlayerID } from "./World/PlayerID";
import { CustomSeedType, GameSettings } from "./GameSettings";
import { BoardState } from "./DisplayState/BoardState";
import { deserializeWorld } from "./World/Deserialize";

export class Game {
  private simulation: Simulation;

  constructor(settingsOrSavedWorld: GameSettings | string) {
    if (typeof settingsOrSavedWorld === "string") {
      const world = deserializeWorld(settingsOrSavedWorld);
      this.simulation = new Simulation(world.gameSettings);
      this.simulation.world = world;
    } else {
      this.simulation = new Simulation(settingsOrSavedWorld);
    }

    // Note: saved worlds do not do the initial board update or bot turn
    // because otherwise a freshly loaded world will not be in the exact same state
    // as the world it was saved from (animations might get cleared, turn would advance).
    // This could cause problems eventually (there would be no way to start a saved gaem
    // where it was a bot turn) so we may at some point need to add some way to control this
    if (typeof settingsOrSavedWorld !== "string") {
      this.simulation.captureBoard("initial state");

      // Match setup skips bot turn if it is player0, to allow for construction of match
      // without automatically taking a turn. Need to force it to take a turn now.
      if (settingsOrSavedWorld.isBot.get(PlayerID.player0)) {
        this.simulation.botController.takeTurn();
      }
    }
  }

  private executePlayerTurn(playerID: PlayerID, actionType: string, executeAction: () => void): void {
    if (this.simulation.turnPlayer.id !== playerID) {
      console.error(`Received ${actionType} for non-current player`);
      return;
    }

    // If we receive a turn for a player, that implies they have all previous board states, so we clear the queue
    this.simulation.world.clearBoardQueue(playerID);

    executeAction();

    this.simulation.captureBoard(actionType);

    if (this.simulation.turnPlayer.actionsLeft === 0) {
      this.endTurn();
    } else {
      // For non-final actions of a turn, put a delay animation in the other player's board queue for the next turn
      // this is to prevent potentially getting both moves at the same time if the time between moves is less
      // than the polling granularity from the UI to the backend
      this.simulation.handleAutoDelay();
    }
  }

  public takeAction(action: Action, playerID: PlayerID): void {
    this.executePlayerTurn(playerID, "action", () => {
      this.simulation.turnPlayerDoAction(action);
    });
  }

  public travel(cityID: string, playerID: PlayerID): void {
    this.executePlayerTurn(playerID, "move", () => {
      this.simulation.turnPlayerTravel(cityID);
    });
  }

  public recordGameCompleted(winner: PlayerID, nextGameIndex: number): GameSettings {
    this.simulation.world.recordGameCompleted(winner, nextGameIndex);
    return this.simulation.world.gameSettings;
  }

  public concede(playerID: PlayerID): void {
    this.simulation.concede(playerID);
    this.simulation.captureBoard("player conceded");
  }

  public saveWorld(): string {
    return JSON.stringify(this.simulation.world, (key, value) => {
      if (
        key === "world" ||
        key === "owner" ||
        key === "location" ||
        key === "target" ||
        key === "_owner" ||
        key === "_location"
      ) {
        return undefined;
      }
      if (key === "potentialLocations") {
        return Array.from(value);
      }
      return value;
    });
  }

  public getQueuedBoardStates(player: PlayerID): BoardState[] {
    return this.simulation.world.boardQueue[player];
  }

  private endTurn(): void {
    this.simulation.turnPlayerDoAction(Action.pass);
    this.simulation.captureBoard("end turn");
  }

  public getPlayerId(username: string): PlayerID {
    if (this.simulation.world.gameSettings.playerNames.get(PlayerID.player0) === username) {
      return PlayerID.player0;
    } else if (this.simulation.world.gameSettings.playerNames.get(PlayerID.player1) === username) {
      return PlayerID.player1;
    }
    throw new Error("Player not found");
  }

  public getPlayerNames(): string[] {
    return [
      this.simulation.world.gameSettings.playerNames.get(PlayerID.player0),
      this.simulation.world.gameSettings.playerNames.get(PlayerID.player1),
    ];
  }

  public getPlayerNameById(id: PlayerID): string {
    return this.simulation.world.gameSettings.playerNames.get(id)!;
  }

  public getTurnPlayerUsername(): string {
    return this.getPlayerNameById(this.simulation.turnPlayer.id);
  }

  public getOtherPlayerNameById(id: PlayerID): string {
    return this.simulation.world.gameSettings.playerNames.get(otherPlayer(id))!;
  }

  public getMapId(): string {
    return this.simulation.world.gameSettings.mapStructure.id;
  }

  public getSeed(): number {
    return this.simulation.world.seed;
  }

  public recordWin(winner: PlayerID): void {
    this.simulation.world.gameSettings.recordWin(winner);
  }

  public isMatchComplete(): boolean {
    return this.simulation.world.gameSettings.isMatchComplete();
  }

  public anyPlayerHasConceded(): boolean {
    return this.simulation.anyPlayerHasConceded();
  }

  public matchHistory(): (PlayerID | null)[] {
    return this.simulation.world.gameSettings.matchHistory;
  }

  public cloneGameSettings(): GameSettings {
    const randomSeed = Math.floor(Math.random() * 10000000);
    const newGameSettings = new GameSettings();
    newGameSettings.worldSeed = new CustomSeedType(randomSeed);
    newGameSettings.mapStructure = this.simulation.world.gameSettings.mapStructure;
    newGameSettings.playerNames = this.simulation.world.gameSettings.playerNames;
    newGameSettings.matchHistory = this.simulation.world.gameSettings.matchHistory;
    return newGameSettings;
  }

  public getCreatedAt(): Date {
    return this.simulation.world.createdAt;
  }

  public isBotMatch(): boolean {
    return (
      this.simulation.world.gameSettings.isBot.get(PlayerID.player0) ||
      this.simulation.world.gameSettings.isBot.get(PlayerID.player1)
    );
  }
}
