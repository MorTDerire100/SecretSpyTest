import { PlayerID } from "../World/PlayerID";
import { City } from "../World/City";
import { Player } from "../World/Player";
import { ClosedState, canEnter } from "../World/ClosedState";
import { PlayerMarkerState } from "./PlayerMarkerState";

export class CityDisplayState {
  cityID: string;
  ownerID: PlayerID | undefined;
  ownerColor: string | undefined;
  ownerHueShiftDegrees: number | undefined;
  markerStates: PlayerMarkerState[] = [];
  intelPerTurn: number;
  bonusIntelPerTurn: number;
  intelShown: number = 0;
  actionShown: boolean;
  closedState: ClosedState;
  isBonus: boolean;
  targetCouldBeHere: boolean;
  bothPlayersShownHere: boolean;
  thisPlayerId: PlayerID;
  renderConnections: boolean;
  thisPlayerInDeepCover: boolean;
  thisPlayerCurrentlyRevealedToTarget: boolean;

  constructor(
    city: City,
    players: Player[],
    thisPlayer: Player,
    targetPlayer: Player,
    isRoundOver: boolean,
    intelPerTurn: number,
    bonusIntelPerTurn: number
  ) {
    this.cityID = city.id;
    this.closedState = city.closedState;
    this.ownerID = city.owner?.id;
    this.isBonus = city.isBonus;
    this.targetCouldBeHere = targetPlayer.isSuperRevealed(thisPlayer) ? false : targetPlayer.isPotentiallyIn(city);
    this.thisPlayerId = thisPlayer.id;
    this.actionShown = city.actionHere;
    this.intelPerTurn = intelPerTurn;
    this.bonusIntelPerTurn = bonusIntelPerTurn;
    // Game state variables (ie. general, not specific to this city)
    this.thisPlayerInDeepCover = thisPlayer.inDeepCover;
    this.thisPlayerCurrentlyRevealedToTarget = thisPlayer.isSuperRevealed(targetPlayer);

    // For each player, determine reveal state
    for (const player of players) {
      const isGameOveredHere = isRoundOver && player.location === city;
      const revealAgeHere = isGameOveredHere ? 0 : player.getRevealAgeForCity(city, thisPlayer);

      if (revealAgeHere !== undefined) {
        const isUndercover = thisPlayer.id === player.id && revealAgeHere !== 0;
        const markerState = new PlayerMarkerState(player.id, revealAgeHere, isUndercover);

        this.markerStates.push(markerState);
      }
    }

    const playerId = this.markerStates.length > 0 ? this.markerStates[0].playerID : undefined;
    this.bothPlayersShownHere = this.markerStates.some((m) => m.playerID !== playerId);

    this.renderConnections = canEnter(this.closedState) || this.targetCouldBeHere || thisPlayer.location === city;

    this.intelShown = city.intelHere;
  }
}
