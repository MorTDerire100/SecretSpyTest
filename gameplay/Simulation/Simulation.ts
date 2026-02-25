import { World } from "../World/World";
import { Player } from "../World/Player";
import { Action, costsActionPoint, isSignalledToTarget, usedDescription } from "../World/Action";
import { CoverEffect } from "../DisplayState/CoverEffect";
import { BoardAnimation } from "../DisplayState/BoardAnimation";
import { FatalEvent } from "../World/FatalEvent";
import { City } from "../World/City";
import { Move } from "../World/Move";
import { GameSettings } from "../GameSettings";
import { BotController } from "./BotController";
import { AbilityController } from "../DisplayState/AbilityController";
import { RevealManager } from "./RevealManager";
import { RecordStat } from "../World/Player";
import { UnlockVisibility } from "../World/UnlockIndicatorState";
import { CityClosingController } from "./CityClosingController";
import { BoardState } from "../DisplayState/BoardState";
import { PlayerID } from "../World/PlayerID";

const AUTO_DELAY_SECONDS = 1.5;

export class Simulation {
  world: World;
  botController: BotController;
  abilityController: AbilityController;
  revealManager: RevealManager;

  constructor(gameSettings: GameSettings) {
    this.world = new World(gameSettings);
    this.botController = new BotController();
    this.abilityController = new AbilityController(this);
    this.revealManager = new RevealManager();

    // Inject dependencies
    this.abilityController.simulation = this;
    this.botController.simulation = this;
    this.botController.abilityController = this.abilityController;
    this.revealManager.simulation = this;

    // Set up for the first turn
    this.startTurn(true);
  }

  get gameIsOver(): boolean {
    return this.world.players.some((p) => p.isDead);
  }

  get turnPlayer(): Player {
    return this.world.turnPlayer;
  }

  get nextTurnPlayer(): Player {
    return this.world.nextTurnPlayer;
  }

  startTurn(isFirstTurn: boolean = false): void {
    console.log(`Starting turn ${this.world.turnNo} for playerID ${this.turnPlayer.id}.`);

    this.turnPlayer.resetForNewTurn();
    this.turnPlayer.gainActions();

    // Handle intel reveals and pickups
    for (const city of this.world.cities) {
      this.revealManager.handleTurnStartReveals(city);
    }

    if (!this.world.gameSettings.isTutorial) {
      this.world.addRandomIntel();
      new CityClosingController(this.world).cityClosingPass();
    }

    if (this.world.turnNo === 0) {
      // On the first turn, everybody knows for sure the location of everybody who moves after them
      for (const player of this.world.players) {
        player.reveal(FatalEvent.firstTurn);
      }
    } else if (this.world.turnNo > 0) {
      // Give intel
      this.world.gainIntel(this.turnPlayer);
    }

    if (this.world.hasTurnStarted) {
      throw new Error("Can't start a turn twice.");
    }
    this.world.hasTurnStarted = true;

    // If first player is a bot, don't want it to take its turn before the construction of the match is complete
    if (!isFirstTurn && this.turnPlayer.isBot) {
      // Capture the initial board state before the bot starts taking actions
      // This allows the human player to see the board state when the bot's turn begins
      this.captureBoard("bot turn started");
      this.botController.takeTurn();
    }
  }

  turnPlayerDoAction(action: Action): void {
    console.log(`Current player taking action: ${action}`);

    if (this.costForAction(action) > this.turnPlayer.intel) {
      console.error(`Action: ${action}, playerId: ${this.turnPlayer.id}, isBot: ${this.turnPlayer.isBot}`);
      console.error("Tried to use action but player does not have enough intel.");
      return;
    }

    if (costsActionPoint(action)) {
      if (this.turnPlayer.actionsLeft <= 0) {
        console.log(`Action: ${action}, playerId: ${this.turnPlayer.id}, isBot: ${this.turnPlayer.isBot}`);
        console.error("Tried to use action but player has no actions left.");
        return;
      }
      this.turnPlayer.startAction(action);
    }

    this.recordAction(action);

    const playSameCityAnimationIfNecessary = () => {
      if (this.shouldPlaySameCityAnimation(this.turnPlayer)) {
        this.world.queueAnimation(BoardAnimation.enemyCouldBeHere(this.turnPlayer.location.id), this.turnPlayer.id);
      }
      if (this.shouldPlaySameCityAnimation(this.nextTurnPlayer)) {
        this.world.queueAnimation(
          BoardAnimation.enemyCouldBeHere(this.nextTurnPlayer.location.id),
          this.nextTurnPlayer.id
        );
      }
    };

    switch (action) {
      case Action.nothing:
        break;
      case Action.strike:
        this.turnPlayer.recordStat(RecordStat.strike);
        this.turnPlayerStrike();
        break;
      case Action.control:
        this.turnPlayer.recordStat(RecordStat.control);
        this.turnPlayerControlCity();
        break;
      case Action.interrogate:
        this.turnPlayerInterrogate();
        break;
      case Action.pass:
        // Check if the player needs to be forced out of a closed city due to turn timeout
        this.leaveClosedCity();
        playSameCityAnimationIfNecessary();
        this.passTurnStartNext();
        break;
      case Action.wait:
        this.turnPlayerWait();
        break;
      case Action.timedOut:
        this.turnPlayerTimedOut();
        break;
      case Action.prepareMission:
        this.turnPlayerPrepareMission();
        break;
      case Action.deepCover:
        this.turnPlayer.recordStat(RecordStat.deepCover);
        this.turnPlayerEnterDeepCover();
        break;
      case Action.rapid:
        this.unlockRapid();
        break;
      case Action.reveal:
        this.turnPlayer.recordStat(RecordStat.reveal);
        this.remoteReveal();
        break;
      case Action.encryption:
        this.unlockEncryption();
        break;
      case Action.unlockStrikeReports:
        this.unlockStrikeReports();
        break;
      case Action.move:
        throw new Error("Can't act a move.");
      default:
        throw new Error(`Unhandled action: ${action}`);
    }

    const wasSuperRevealed = this.turnPlayer.isSuperRevealed(this.nextTurnPlayer);
    if (!wasSuperRevealed && !isSignalledToTarget(action) && costsActionPoint(action)) {
      // A sneaky action, likely a wait
      this.world.expandPossibleLocations(this.turnPlayer);
    }

    // pass is handled separately above
    if (action !== Action.pass) {
      playSameCityAnimationIfNecessary();
    }
  }

  private turnPlayerStrike(): void {
    console.log("[Simulation] Begin strike");
    const striker = this.turnPlayer;
    const target = this.nextTurnPlayer;
    const killed = striker.location === target.location;
    const locationVisibleToTarget =
      (!striker.inDeepCover && target.hasStrikeReports) || striker.isSuperRevealed(target) || killed;

    if (!target.isSuperRevealed(striker)) {
      this.world.queueAnimation(BoardAnimation.showPreStrikeZoom(striker.location.id), striker.id);
    }

    if (!striker.isSuperRevealed(target)) {
      this.world.queueAnimation(
        BoardAnimation.showPreStrikeBullseye(Array.from(striker.potentialLocations)),
        target.id
      );
    }

    this.world.queueAnimation(BoardAnimation.struck(striker.id, striker.location.id, killed), striker.id);

    this.world.queueAnimation(
      BoardAnimation.struck(striker.id, locationVisibleToTarget ? striker.location.id : null, killed),
      target.id
    );

    if (killed) {
      target.isDead = true;
      target.reveal(FatalEvent.killedByStrike);

      if (striker.preparedMission) {
        target.addRevealReason(FatalEvent.prepareMission, striker.location);
      } else if (striker.didPickUpActionThisTurn) {
        target.addRevealReason(FatalEvent.extraActionKill, striker.location);
      }

      this.world.queueAnimation(BoardAnimation.successfulStrike());
      this.revealManager.revealTurnPlayer(FatalEvent.failedStrike);
      this.turnPlayer.recordStat(RecordStat.kills);
    } else {
      const wasVisible = !striker.inDeepCover && target.hasStrikeReports;
      if (wasVisible) {
        striker.reveal(
          FatalEvent.failedStrike,
          target.strikeReportsVisibility === UnlockVisibility.visiblyUnlocked ? undefined : target
        );
      }
      this.world.queueAnimation(BoardAnimation.missedStrike(wasVisible), target.id);

      // Player wasn't here
      target.potentialLocations.delete(striker.location.id);

      // Striker wasn't in player's city
      striker.potentialLocations.delete(target.location.id);
    }

    this.completeAction();

    this.captureBoard("resolve strike");
  }

  private turnPlayerControlCity(): void {
    const city = this.turnPlayer.location;
    city.owner = this.turnPlayer;
    this.revealManager.revealTurnPlayer(FatalEvent.controlled);

    if (this.revealManager.turnPlayerControlWouldFindTarget()) {
      this.nextTurnPlayer.reveal(FatalEvent.revealedByControl);
    } else if (!(this.nextTurnPlayer.inDeepCover || this.nextTurnPlayer.couldBeInDeepCover)) {
      this.nextTurnPlayer.potentialLocations.delete(city.id);
    }
    this.completeAction();
  }

  private turnPlayerPrepareMission(): void {
    this.turnPlayer.bonusActionsNextTurn += 1;

    if (!this.turnPlayer.hasEncryption) {
      this.turnPlayer.publicBonusActionsNextTurn += 1;
    }

    this.turnPlayerSpendIntel(Action.prepareMission);
    this.completeAction();
  }

  private turnPlayerSpendIntel(action: Action): void {
    const cost = this.costForAction(action);
    const description = this.descriptionForAction(action);

    const player = this.turnPlayer;
    player.intel -= cost;

    const intelUseWasSecret = player.hasEncryption && action !== Action.encryption;

    if (intelUseWasSecret || action === Action.deepCover) {
      player.couldBeInDeepCover = true;
    }

    if (intelUseWasSecret) {
      player.encryptedActions += 1;
    }

    const didFailReveal = action === Action.reveal && this.nextTurnPlayer.inDeepCover;

    let text = didFailReveal ? "failed to learn your location" : description;
    if (intelUseWasSecret) {
      text = "spent intel on an operation.";
    }

    this.world.queueAnimation(BoardAnimation.intelUsed(text), this.nextTurnPlayer.id);
  }

  // History management
  private recordMove(action: Action, cityID?: string): void {
    const move = new Move(this.turnPlayer.id, cityID || null, action, this.world.turnNo, this.world.moveNo);
    this.world.moveHistory.push(move);
    this.world.moveNo += 1;
  }

  private recordAction(action: Action): void {
    this.recordMove(action);
  }

  private recordTravel(cityID: string): void {
    this.recordMove(Action.move, cityID);
  }

  private costForAction(action: Action): number {
    return this.abilityController.getAbilityCost(action);
  }

  private descriptionForAction(action: Action): string {
    return usedDescription(action);
  }

  private completeAction(): void {
    // TODO: not doing anything any more, remove?
  }

  private shouldPlaySameCityAnimation(player: Player): boolean {
    // if it's the last action in a turn
    return (
      this.turnPlayer.actionsLeft === 0 &&
      // the other player is potentially in the same city
      player.target.isPotentiallyIn(player.location) &&
      // the other player isn't super revealed
      !player.target.isSuperRevealed(player) &&
      // the other player couldn't be in deep cover
      !player.target.couldBeInDeepCover
    );
  }

  private leaveClosedCity(): void {
    const location = this.turnPlayer.location;

    // Check if we need to leave - either closed or about to close
    // Note: TypeScript doesn't have enum closedState like Swift, so using isClosed
    if (!location.isClosed) {
      return;
    }

    const openNeighbors = this.world.openNeighboursForCity(location);

    if (openNeighbors.length === 0) {
      console.error("Closed player location has no open neighbours");
      return;
    }

    const defaultLocation = openNeighbors[0];
    let cityToMoveTo: { quality: number; city: City } = { quality: -100, city: defaultLocation };

    for (const possibleCity of openNeighbors) {
      let chanceToMove = 0;

      if (possibleCity.owner) {
        chanceToMove += possibleCity.owner === this.turnPlayer ? 3 : -3;
      }
      if (this.nextTurnPlayer.isPotentiallyIn(possibleCity)) {
        chanceToMove -= 1;
      }
      if (this.nextTurnPlayer.location === possibleCity) {
        chanceToMove -= 10;
      }
      if (chanceToMove > cityToMoveTo.quality) {
        cityToMoveTo.quality = chanceToMove;
        cityToMoveTo.city = possibleCity;
      }
    }

    this.turnPlayerTravel(cityToMoveTo.city.id);
    this.world.queueAnimation(
      BoardAnimation.showAlert(
        "You can't end your turn in a closed city",
        `You were forced to flee to ${this.turnPlayer.location.name}`,
        true
      ),
      this.turnPlayer.id
    );
  }

  private passTurnStartNext(): void {
    if (this.gameIsOver) {
      // game is over, don't need to reset for next turn
      return;
    }

    // Expand potential locations if there were extra actions
    const endingTurnPlayer = this.turnPlayer;

    // They can't end in a closed city
    for (const closedCity of this.world.cities.filter((c) => c.isClosed)) {
      endingTurnPlayer.potentialLocations.delete(closedCity.id);
    }

    endingTurnPlayer.hasBeenRevealedThisTurn = false;

    // Player only gets bonus actions from preparing mission for one turn
    if (endingTurnPlayer.preparedMission) {
      endingTurnPlayer.preparedMission = false;
    }

    this.world.turnPlayer = this.nextTurnPlayer;
    console.log(`Changed turn player to ${this.turnPlayer.id}.`);
    this.world.hasTurnStarted = false;
    this.world.turnNo += 1;

    // start the next player's turn so you can see its effects
    this.startTurn();
  }

  private turnPlayerWait(): void {
    // Just complete the action, no special handling needed
    this.completeAction();
  }

  private turnPlayerTimedOut(): void {
    // Same as pass, but with a timeout reason
    this.passTurnStartNext();
  }

  private turnPlayerInterrogate(): void {
    // Interrogate the target in the current city
    const city = this.turnPlayer.location;
    const target = this.nextTurnPlayer;

    if (target.location === city) {
      // Target is here, reveal them
      target.reveal(FatalEvent.interrogate);
      this.world.queueAnimation(BoardAnimation.showAlert("Interrogation successful!", "Target found in city."));
    } else {
      // Target is not here, remove this city from their potential locations
      target.potentialLocations.delete(city.id);
      this.world.queueAnimation(BoardAnimation.showAlert("Interrogation failed", "Target not found in city."));
    }

    this.completeAction();
  }

  private turnPlayerEnterDeepCover(): void {
    this.turnPlayer.inDeepCover = true;
    this.turnPlayerSpendIntel(Action.deepCover);
    this.completeAction();
  }

  private unlockRapid(): void {
    this.turnPlayer.hasRapidRecon = true;
    this.turnPlayerSpendIntel(Action.rapid);
    this.completeAction();
  }

  private remoteReveal(): void {
    if (!this.nextTurnPlayer.inDeepCover) {
      // Only the revealer can see the remote reveal if they have silent abilities
      if (this.turnPlayer.hasEncryption) {
        this.nextTurnPlayer.reveal(FatalEvent.remoteReveal, this.turnPlayer);
      } else {
        this.nextTurnPlayer.reveal(FatalEvent.remoteReveal);
      }
    } else {
      this.world.queueAnimation(BoardAnimation.revealDeepCover(), this.turnPlayer.id);
    }
    this.turnPlayerSpendIntel(Action.reveal);
    this.completeAction();
  }

  private unlockEncryption(): void {
    this.turnPlayer.hasEncryption = true;
    this.turnPlayerSpendIntel(Action.encryption);
    this.completeAction();
  }

  private unlockStrikeReports(): void {
    this.turnPlayer.hasStrikeReports = true;
    this.turnPlayerSpendIntel(Action.unlockStrikeReports);
    this.completeAction();
  }

  public anyPlayerHasConceded(): boolean {
    return this.world.players.some((p) => p.lastFatalEvent === FatalEvent.concede);
  }

  concede(playerID: PlayerID): void {
    // First check and make sure the match is not already over
    if (this.world.gameSettings.isMatchComplete()) {
      console.error("Cannot concede if the match is already over");
      return;
    }

    const player = this.world.players.find((p) => p.id === playerID);
    if (!player) {
      console.error(`Player ${playerID} not found`);
      return;
    }
    player.reveal(FatalEvent.concede);
    player.lastFatalEvent = FatalEvent.concede;
    player.isDead = true;
    this.captureBoard("player conceded", true); // force capture board to record the concession, even if game is already over (could be a disconnect concede on game over screen)
    this.world.gameSettings.recordPlayerConceded(playerID);
  }

  turnPlayerMustMove(): boolean {
    return this.turnPlayer.location.isClosed && this.turnPlayer.actionsLeft <= 1;
  }

  turnPlayerTravel(cityID: string): void {
    console.log(`Current player moving to: ${cityID}`);

    if (
      !this.world
        .openNeighboursForCity(this.turnPlayer.location)
        .map((c: City) => c.id)
        .includes(cityID)
    ) {
      console.error(`PlayerId: ${this.turnPlayer.id}, isBot: ${this.turnPlayer.isBot}, cityID: ${cityID}`);
      console.error("Tried to travel to a city that is closed or not adjacent");
      return;
    }

    const player = this.turnPlayer;
    player.startAction(Action.move);

    this.recordTravel(cityID);
    this.moveTurnPlayerToCity(cityID);

    const wasSuperRevealed = this.turnPlayer.isSuperRevealed(this.nextTurnPlayer);

    if (!wasSuperRevealed) {
      this.world.expandPossibleLocations(this.turnPlayer);
      this.world.queueAnimation(BoardAnimation.finishedSneakyTravel(player.actionsLeft, player.couldBeInDeepCover));
    }
  }

  private moveTurnPlayerToCity(cityID: string): void {
    const toCity = this.world.city(cityID);
    this.turnPlayer.location = toCity;

    this.revealManager.handlePostMoveReveals();
    this.turnPlayer.recordStat(RecordStat.travel);
    this.completeAction();
  }

  captureBoard(debugReason: string = "", force: boolean = false): void {
    const lastBoardStatePlayer0 = this.world.lastBoardState(PlayerID.player0);

    // stop capturing new board states once we have a winnder
    if (!force && lastBoardStatePlayer0 !== undefined) {
      if (lastBoardStatePlayer0.winState !== undefined) {
        return;
      }
    }

    if (!this.world.players[PlayerID.player0].isBot) {
      this.world.boardQueue[PlayerID.player0].push(new BoardState(PlayerID.player0, this, debugReason));
    }
    if (!this.world.players[PlayerID.player1].isBot) {
      this.world.boardQueue[PlayerID.player1].push(new BoardState(PlayerID.player1, this, debugReason));
    }

    this.world.boardNo += 1;
    this.world.clearAnimations();
  }

  handleAutoDelay(): void {
    // For non-final actions of a turn, add an artificial delay to the other (human) player's queue for the next turn, to help smooth out UI behaviour
    if (!this.nextTurnPlayer.isBot && this.turnPlayer.actionsLeft != 0 && !this.gameIsOver) {
      this.world.queueAnimation(BoardAnimation.delay(AUTO_DELAY_SECONDS), this.nextTurnPlayer.id);
    }
  }
}
