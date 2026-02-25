import { PlayerID } from "./PlayerID";
import { FatalEvent } from "./FatalEvent";
import { City } from "./City";
import { Loadout } from "./Loadout";
import { Action, isSignalledToTarget, isIntelUsage } from "./Action";
import { GameSettings } from "../GameSettings";
import { World } from "./World";
import { UnlockVisibility } from "./UnlockIndicatorState";
import { BoardAnimation } from "../DisplayState/BoardAnimation";

export enum RecordStat {
  strike,
  travel,
  deepCover,
  control,
  wasRevealed,
  reveal,
  intelPickup,
  kills,
}

export interface Reveal {
  event: FatalEvent;
  cityID?: string;
  age: number;
  onlyVisibleTo?: PlayerID;
}

export class Player {
  id: PlayerID;
  world!: World;

  private _locationID!: string;
  private _location!: City;

  private revealToSelf?: Reveal; // this player's latest reveal state from their perspective
  private revealToTarget?: Reveal; // this player's latest reveal state from the opponent's perspective

  potentialLocations: Set<string> = new Set<string>();

  intel: number = 0;
  didPickUpIntelThisTurn: boolean = false;
  didPickUpActionThisTurn: boolean = false;
  wasInDeepCover: boolean = false;

  target!: Player;

  private _couldBeInDeepCover: boolean = false; // For potential location reasoning
  private _inDeepCover: boolean = false;

  get couldBeInDeepCover(): boolean {
    return this._couldBeInDeepCover;
  }

  // TODO: this used to have a more complciated setter, but it proved unccessary, but leaving it like this for now rather
  // than just replacing with a simple variable to avoid having to change the serialized format, which uses _couldBeInDeepCover,
  // should eventually be removed
  set couldBeInDeepCover(value: boolean) {
    this._couldBeInDeepCover = value;
  }

  encryptedActions: number = 0;
  isDead: boolean = false;

  get hasRapidRecon(): boolean {
    return (
      this.rapidReconUnlockVisibility === UnlockVisibility.visiblyUnlocked ||
      this.rapidReconUnlockVisibility === UnlockVisibility.secretlyUnlocked
    );
  }

  set hasRapidRecon(value: boolean) {
    this.rapidReconUnlockVisibility = this.setUnlockVisibility(
      this.rapidReconUnlockVisibility,
      value,
      this.hasEncryption
    );
  }

  get inDeepCover(): boolean {
    return (
      this.deepCoverUnlockVisibility === UnlockVisibility.visiblyUnlocked ||
      this.deepCoverUnlockVisibility === UnlockVisibility.secretlyUnlocked
    );
  }

  set inDeepCover(value: boolean) {
    this.deepCoverUnlockVisibility = this.setUnlockVisibility(
      this.deepCoverUnlockVisibility,
      value,
      this.hasEncryption,
      this.couldBeInDeepCover
    );
  }

  get hasStrikeReports(): boolean {
    return (
      this.strikeReportsVisibility === UnlockVisibility.visiblyUnlocked ||
      this.strikeReportsVisibility === UnlockVisibility.secretlyUnlocked
    );
  }

  set hasStrikeReports(value: boolean) {
    this.strikeReportsVisibility = this.setUnlockVisibility(this.strikeReportsVisibility, value, this.hasEncryption);
  }

  hasEncryption: boolean = false;

  rapidReconUnlockVisibility: UnlockVisibility = UnlockVisibility.visiblyLocked;
  deepCoverUnlockVisibility: UnlockVisibility = UnlockVisibility.visiblyLocked;
  strikeReportsVisibility: UnlockVisibility = UnlockVisibility.visiblyLocked;

  actionsLeft: number = 0;
  lastFatalEvent?: FatalEvent;
  loadout: Loadout = new Loadout();
  hasBeenRevealedThisTurn: boolean = false;
  bonusActionsNextTurn: number = 0;
  publicBonusActionsNextTurn: number = 0; // That your opponent saw
  preparedMission: boolean = false;
  isBot: boolean = false;

  recordedStats: Map<RecordStat, number> = new Map<RecordStat, number>();

  constructor(playerID: PlayerID, startingCity: City, gameSettings: GameSettings) {
    this.id = playerID;
    this.location = startingCity;
    this._locationID = startingCity.id;
    this.isBot = gameSettings.isBot.get(playerID);
    this.loadout = gameSettings.loadout.get(playerID);
    this.intel = gameSettings.initialIntel.get(playerID);
  }

  get locationID(): string {
    return this._locationID;
  }

  get location(): City {
    return this._location;
  }

  set location(value: City) {
    this._location = value;
    this._locationID = value.id;
  }

  private setUnlockVisibility(
    visibility: UnlockVisibility,
    isAbilityUnlocked: boolean,
    hasEncryption: boolean,
    couldHaveUnlocked: boolean = true
  ): UnlockVisibility {
    // if you've already been visibly unlocked, don't change anything
    if (visibility === UnlockVisibility.visiblyUnlocked && isAbilityUnlocked) {
      return visibility;
    }

    if (isAbilityUnlocked) {
      return hasEncryption ? UnlockVisibility.secretlyUnlocked : UnlockVisibility.visiblyUnlocked;
    } else if (couldHaveUnlocked) {
      return hasEncryption ? UnlockVisibility.secretlyLocked : UnlockVisibility.visiblyLocked;
    } else {
      return UnlockVisibility.visiblyLocked;
    }
  }

  recordStat(stat: RecordStat): void {
    const temp = this.recordedStats.get(stat) || 0;
    this.recordedStats.set(stat, temp + 1);
  }

  resetForNewTurn(): void {
    this.lastFatalEvent = undefined;
    this.inDeepCover = false;
    this.couldBeInDeepCover = false;
    this.encryptedActions = 0;
    this.hasBeenRevealedThisTurn = false;
    this.didPickUpIntelThisTurn = false;
    this.didPickUpActionThisTurn = false;
    this.wasInDeepCover = false;
  }

  gainActions(): void {
    this.actionsLeft = 2 + this.bonusActionsNextTurn;

    if (this.bonusActionsNextTurn > 0) {
      this.preparedMission = true;
      this.bonusActionsNextTurn = 0;
      this.publicBonusActionsNextTurn = 0;
    }
  }

  // MARK: Reveals
  ageReveals(): void {
    // Increase counts on any reveals and remove them as they age out
    const maxAge = 2;

    if (this.revealToSelf) {
      this.revealToSelf.age += 1;
      if (this.revealToSelf.age > maxAge) {
        this.revealToSelf = undefined;
      }
    }

    if (this.revealToTarget) {
      this.revealToTarget.age += 1;
      if (this.revealToTarget.age > maxAge) {
        this.revealToTarget = undefined;
      }
    }
  }

  reveal(reason: FatalEvent, onlyToPlayer?: Player): void {
    if (this.isSuperRevealed(this)) {
      console.info(`Already super revealed, not adding reveal reason ${reason}.`);
      return;
    }

    // They're here - clear other possibilities
    this.potentialLocations = new Set([this.location.id]);

    // If you're revealed, you definitely aren't in deep cover
    this.couldBeInDeepCover = false;
    this.inDeepCover = false;

    this.addRevealReason(reason, this.location, onlyToPlayer);
    this.recordStat(RecordStat.wasRevealed);

    this.world.queueAnimation(BoardAnimation.playerRevealed(this.id, reason), onlyToPlayer?.id);
  }

  addRevealReason(event: FatalEvent, city: City, onlyToPlayer?: Player): void {
    const revealCity = city;

    const reveal: Reveal = {
      event,
      cityID: revealCity.id,
      age: 0,
      onlyVisibleTo: onlyToPlayer?.id,
    };

    switch (event) {
      case FatalEvent.killedByStrike:
        // don't put the killed event as the last fatal event, that's redundant
        break;
      case FatalEvent.rapidReconFound:
        const revealForCity = this.revealToTarget?.cityID === city.id ? this.revealToTarget : undefined;
        this.lastFatalEvent = revealForCity?.event ?? FatalEvent.rapidReconFound;
        break;
      default:
        this.lastFatalEvent = event;
    }

    if (!onlyToPlayer) {
      this.revealToSelf = reveal;
      this.revealToTarget = reveal;
    } else if (onlyToPlayer === this) {
      this.revealToSelf = reveal;
    } else {
      // onlyToPlayer must be target
      this.revealToTarget = reveal;
    }

    this.hasBeenRevealedThisTurn = true;
  }

  getReveal(to: Player): Reveal | undefined {
    return to === this ? this.revealToSelf : this.revealToTarget;
  }

  getRevealForCity(targetCity: City, seenByPlayer: Player): Reveal | undefined {
    const candidate = this.getReveal(seenByPlayer);
    if (candidate && candidate.cityID && candidate.cityID === targetCity.id) {
      return candidate;
    }
    return undefined;
  }

  getRevealAgeForCity(city: City, seenByPlayer: Player): number | undefined {
    return this.getRevealForCity(city, seenByPlayer)?.age;
  }

  isSuperRevealed(toPlayer: Player): boolean {
    const reveal = this.getReveal(toPlayer);
    return reveal ? reveal.age === 0 : false;
  }

  isSuperRevealedToSelf(): boolean {
    return this.revealToSelf ? this.revealToSelf.age === 0 : false;
  }

  isPotentiallyIn(city: City): boolean {
    return this.potentialLocations.has(city.id);
  }

  startAction(action: Action): void {
    this.actionsLeft -= 1;

    if (isIntelUsage(action) && this.hasEncryption) {
      // Intel usage could have unlocked something, so update visibility (anything that is visibilyLocked, will become secretlyLocked)
      this.rapidReconUnlockVisibility = this.setUnlockVisibility(
        this.rapidReconUnlockVisibility,
        this.hasRapidRecon,
        true
      );
      this.strikeReportsVisibility = this.setUnlockVisibility(
        this.strikeReportsVisibility,
        this.hasStrikeReports,
        true
      );
      this.deepCoverUnlockVisibility = this.setUnlockVisibility(this.deepCoverUnlockVisibility, this.inDeepCover, true);
    }

    if (action === Action.wait) {
      // wait actions should look identical to a travel on the client side, so we send the exact same animation as a travel
      // rather than a known or unknown action
      this.world.queueAnimation(BoardAnimation.finishedSneakyTravel(this.actionsLeft, this.couldBeInDeepCover));
    } else if (this.hasEncryption) {
      this.world.queueAnimation(BoardAnimation.startedUnknownAction(isIntelUsage(action)));
    } else {
      this.world.queueAnimation(BoardAnimation.startedKnownAction(action));
    }

    if (!isSignalledToTarget(action)) {
      // We don't age reveals on intel usage since they don't reveal
      // But they're signalled so they can't be a move.
      this.ageReveals();
    }
  }

  pickupAction(): void {
    this.actionsLeft += 1;
    this.location.actionHere = false;
    this.reveal(FatalEvent.actionPickup);
    this.didPickUpActionThisTurn = true;

    this.world.queueAnimation({
      type: "gotAction",
      player: this.id,
      city: this.location.id,
    });
  }

  pickupIntel(): void {
    this.intel += this.location.intelHere;

    this.world.queueAnimation({
      type: "gotIntel",
      player: this.id,
      city: this.location.id,
      amount: this.location.intelHere,
    });

    this.location.intelHere = 0;

    this.recordStat(RecordStat.intelPickup);
    this.reveal(FatalEvent.intelPickup);
    this.didPickUpIntelThisTurn = true;
  }

  isUnlocked(ability: Action): boolean {
    switch (ability) {
      case Action.encryption:
        return this.hasEncryption;
      case Action.rapid:
        return this.hasRapidRecon;
      case Action.deepCover:
        return this.inDeepCover;
      case Action.unlockStrikeReports:
        return this.hasStrikeReports;
      default:
        return false;
    }
  }
}
