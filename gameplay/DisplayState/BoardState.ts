import { PlayerID, otherPlayer as getOtherPlayer, otherPlayer } from "../World/PlayerID";
import { Action } from "../World/Action";
import { FatalEvent } from "../World/FatalEvent";
import { UnlockIndicatorState, fromUnlockVisibility } from "../World/UnlockIndicatorState";
import { DossierDisplayState } from "./DossierDisplayState";
import { CityDisplayState } from "./CityDisplayState";
import { Simulation } from "../Simulation/Simulation";
import { Player } from "../World/Player";
import { City } from "../World/City";
import { BoardAnimation } from "./BoardAnimation";

export class BoardState {
  playerID: PlayerID;
  turn: number;
  move: number;
  boardNumber: number;
  turnPlayer: PlayerID;
  winState: WinState | undefined;
  playerCity: string;
  validTravelCities: string[];
  opponentRemainingActions: number;
  opponentUnlockables: Record<Action, UnlockIndicatorState>;
  remainingActions: number;
  intel: number;
  dossiers: DossierDisplayState[];
  cities: CityDisplayState[];
  animations: BoardAnimation[];
  matchHistory: (PlayerID | null)[];
  turnPlayerPassedLastTurn: boolean;

  debugReason: string;

  get gameOver(): boolean {
    return this.winState !== undefined;
  }

  constructor(playerID: PlayerID, simulation: Simulation, debugReason: string = "") {
    const thisPlayer = simulation.world.players[playerID];
    const opponent = simulation.world.players[getOtherPlayer(playerID)];

    this.playerID = playerID;
    this.turn = simulation.world.turnNo;
    this.move = simulation.world.moveNo;
    this.boardNumber = simulation.world.boardNo;
    this.turnPlayer = simulation.turnPlayer.id;
    this.debugReason = debugReason;

    if (simulation.gameIsOver) {
      const winner = simulation.world.players.find((p: Player) => !p.isDead)!;
      const loser = simulation.world.players.find((p: Player) => p.isDead)!;

      // If both players are dead, due to a bug in the concession logic this will crash.
      // Instead just set the win state to a default value to get past it.
      if (winner === undefined) {
        this.winState = new WinState(otherPlayer(loser.id), FatalEvent.concede);
      } else {
        this.winState = new WinState(winner.id, loser.lastFatalEvent);
      }
    }

    this.playerCity = thisPlayer.location.id;
    this.validTravelCities =
      simulation.turnPlayer.id === thisPlayer.id && thisPlayer.actionsLeft > 0
        ? simulation.world.openNeighboursForCity(thisPlayer.location).map((c: City) => c.id)
        : [];
    this.opponentRemainingActions = opponent.actionsLeft;

    this.opponentUnlockables = {} as Record<Action, UnlockIndicatorState>;

    if (opponent.loadout.abilities.includes(Action.encryption)) {
      this.opponentUnlockables[Action.encryption] = opponent.hasEncryption
        ? UnlockIndicatorState.unlocked
        : UnlockIndicatorState.locked;
    }

    if (opponent.loadout.abilities.includes(Action.deepCover)) {
      this.opponentUnlockables[Action.deepCover] = fromUnlockVisibility(opponent.deepCoverUnlockVisibility);
    }

    if (opponent.loadout.abilities.includes(Action.rapid)) {
      this.opponentUnlockables[Action.rapid] = fromUnlockVisibility(opponent.rapidReconUnlockVisibility);
    }

    if (opponent.loadout.abilities.includes(Action.unlockStrikeReports)) {
      this.opponentUnlockables[Action.unlockStrikeReports] = fromUnlockVisibility(opponent.strikeReportsVisibility);
    }

    this.remainingActions = thisPlayer.actionsLeft;
    this.intel = thisPlayer.intel;
    this.matchHistory = simulation.world.gameSettings.matchHistory;
    this.dossiers = thisPlayer.loadout.abilities.map((a: Action) => new DossierDisplayState(a, thisPlayer, simulation));
    this.cities = simulation.world.cities.map((c: City) => {
      const intelPerTurn = simulation.world.intelCapacityForCity(c, thisPlayer.loadout);
      const bonusIntelPerTurn = simulation.world.bonusCapacityForCity(c, thisPlayer.loadout);

      return new CityDisplayState(
        c,
        simulation.world.players,
        thisPlayer,
        opponent,
        simulation.gameIsOver,
        intelPerTurn,
        bonusIntelPerTurn
      );
    });

    this.animations = simulation.world.currentTurnAnimations[playerID];

    // Check if the turn player passed on their previous turn by scanning move history
    this.turnPlayerPassedLastTurn = this.checkTurnPlayerPassedLastTurn(simulation);
  }

  /**
   * Checks if the current turn player's previous turn consisted of only a pass action.
   * This is used to detect when a player passes twice in a row (which counts as a concede).
   */
  private checkTurnPlayerPassedLastTurn(simulation: Simulation): boolean {
    const moveHistory = simulation.world.moveHistory;
    const currentTurnPlayer = simulation.turnPlayer.id;

    // Find the previous turn number for this player and collect all moves from that turn
    let previousTurnNo: number | null = null;
    const previousTurnMoves: Action[] = [];

    for (let i = moveHistory.length - 1; i >= 0; i--) {
      const move = moveHistory[i];
      if (move.playerID !== currentTurnPlayer || move.turnNo === null) {
        continue;
      }

      if (previousTurnNo === null) {
        // First move we find - this is the previous turn
        previousTurnNo = move.turnNo;
        previousTurnMoves.push(move.action);
      } else if (move.turnNo === previousTurnNo) {
        // Same turn, collect the move
        previousTurnMoves.push(move.action);
      } else {
        // Reached an earlier turn, stop
        break;
      }
    }

    // Return true only if the previous turn had exactly one action and it was a pass
    return previousTurnMoves.length === 1 && previousTurnMoves[0] === Action.pass;
  }
}

export class WinState {
  winner: PlayerID;
  reason: FatalEvent | undefined;

  constructor(winner: PlayerID, reason: FatalEvent | undefined) {
    this.winner = winner;
    this.reason = reason;
  }
}
