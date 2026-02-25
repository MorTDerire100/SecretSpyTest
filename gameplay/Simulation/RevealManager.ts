import { Simulation } from "./Simulation";
import { Player } from "../World/Player";
import { City } from "../World/City";
import { FatalEvent } from "../World/FatalEvent";

export class RevealManager {
  simulation: Simulation;

  constructor() {
    this.simulation = {} as Simulation;
  }

  get turnPlayer(): Player {
    return this.simulation.turnPlayer;
  }

  get nextTurnPlayer(): Player {
    return this.simulation.nextTurnPlayer;
  }

  revealTurnPlayer(event: FatalEvent): void {
    this.turnPlayer.reveal(event);
  }

  shouldCauseEnemyTerritoryReveal(city: City): boolean {
    if (city.owner) {
      if (city.owner !== this.turnPlayer && !this.turnPlayer.inDeepCover) {
        return true;
      }
    }

    return false;
  }

  handlePostMoveReveals(): void {
    // You're revealed if this city is owned by someone, and that person is not you
    if (this.shouldCauseEnemyTerritoryReveal(this.turnPlayer.location)) {
      this.revealTurnPlayer(FatalEvent.enemyTerritory);
    }

    // Check for rapid recon reveals and markers
    this.revealForRapidRecon();
  }

  handleTurnStartReveals(city: City): void {
    this.revealForSameCity(city);
    this.revealForEnemyTerritory(city);
    this.revealForAndPickupIntel(city);
    this.revealForAndPickupAction(city);
  }

  private revealForAndPickupIntel(city: City): void {
    if (city.intelHere <= 0) {
      return; // No intel here
    }

    if (this.turnPlayer.location === city) {
      this.turnPlayer.pickupIntel();
    } else {
      this.turnPlayer.potentialLocations.delete(city.id);
    }
  }

  private revealForAndPickupAction(city: City): void {
    if (!city.actionHere) {
      return; // No action here
    }

    if (this.turnPlayer.location === city) {
      this.turnPlayer.pickupAction();
    } else {
      this.turnPlayer.potentialLocations.delete(city.id);
    }
  }

  private revealForSameCity(city: City): void {
    if (this.turnPlayer.location !== city) {
      return; // Turnplayer isn't here
    }

    // Reveal the other player if they're also here and not in deep cover
    if (!this.nextTurnPlayer.inDeepCover && this.nextTurnPlayer.location === city) {
      this.nextTurnPlayer.reveal(FatalEvent.sameCityEndTurn);
      this.revealTurnPlayer(FatalEvent.sameCityStartTurn);
    } else {
      // If the opponent isn't in deep cover remove the current city from their potential locations
      if (!this.nextTurnPlayer.couldBeInDeepCover) {
        this.nextTurnPlayer.potentialLocations.delete(this.turnPlayer.location.id);
      }

      // The current player also can't be in the same location as the opponent, unless they have deep cover
      if (!this.turnPlayer.couldBeInDeepCover && !this.nextTurnPlayer.couldBeInDeepCover) {
        this.turnPlayer.potentialLocations.delete(this.nextTurnPlayer.location.id);
      }

      // If the opponent is in deep cover and turn player is not, reveal them only to the opponent
      if (this.nextTurnPlayer.inDeepCover && !this.turnPlayer.inDeepCover && this.nextTurnPlayer.location === city) {
        this.turnPlayer.reveal(FatalEvent.sameCityDeepCover, this.nextTurnPlayer);
      }
    }
  }

  private revealForEnemyTerritory(city: City): void {
    // Turnplayer should be revealed if they start turn in enemy territory, but not deep cover
    if (city.owner !== this.nextTurnPlayer) {
      return; // This isn't enemy territory for turnPlayer
    }

    if (this.turnPlayer.location === city && !this.turnPlayer.inDeepCover) {
      this.revealTurnPlayer(FatalEvent.enemyTerritory);
    } else if (!this.turnPlayer.couldBeInDeepCover) {
      // They would have been revealed if they were here
      this.turnPlayer.potentialLocations.delete(city.id);
    }
  }

  private revealForRapidRecon(): void {
    if (!this.turnPlayer.hasRapidRecon) {
      return; // No rapid recon
    }

    const inSameCity = this.turnPlayer.location === this.nextTurnPlayer.location;
    const shouldRevealViaRapidRecon = inSameCity && !this.nextTurnPlayer.inDeepCover;

    if (shouldRevealViaRapidRecon) {
      // if turnPlayer is in deep cover, only reveal enemy to the nextTurnPlayer.
      const inDeepCover = this.turnPlayer.inDeepCover;
      this.nextTurnPlayer.reveal(FatalEvent.rapidReconFound, inDeepCover ? this.turnPlayer : undefined);
      if (!inDeepCover) {
        this.revealTurnPlayer(FatalEvent.rapidReconFinder);
      }
    } else if (!this.nextTurnPlayer.couldBeInDeepCover) {
      // They couldn't be here or they'd have been revealed
      this.nextTurnPlayer.potentialLocations.delete(this.turnPlayer.location.id);
    }
  }

  turnPlayerControlWouldFindTarget(): boolean {
    if (this.nextTurnPlayer.inDeepCover) {
      return false;
    }
    return this.turnPlayer.location.id === this.nextTurnPlayer.location.id;
  }
}
