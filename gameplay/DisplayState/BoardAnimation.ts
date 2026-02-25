import { PlayerID } from "../World/PlayerID";
import { Action } from "../World/Action";
import { FatalEvent } from "../World/FatalEvent";

export interface StartedKnownActionAnim {
  type: "startedKnownAction";
  action: Action;
}

export interface StartedUnknownActionAnim {
  type: "startedUnknownAction";
  intelUsed: boolean;
}

export interface FinishedSneakyTravelAnim {
  type: "finishedSneakyTravel";
  actionsLeft: number;
  couldBeDeep: boolean;
}

export interface MissedStrikeAnim {
  type: "missedStrike";
  wasVisible: boolean;
}

export interface SuccessfulStrikeAnim {
  type: "successfulStrike";
}

export interface RevealDeepCoverAnim {
  type: "revealDeepCover";
}

export interface BotHeldStrikeAnim {
  type: "botHeldStrike";
}

export interface CityClosedAnim {
  type: "cityClosed";
  cityId: string;
}

export interface PlayerRevealedAnim {
  type: "playerRevealed";
  player: PlayerID;
  reason: FatalEvent;
  onlyToPlayer?: PlayerID;
}

export interface IntelUsedAnim {
  type: "intelUsed";
  operation: string;
}

export interface StruckAnim {
  type: "struck";
  player: PlayerID;
  city: string | null;
  playerKilled: boolean;
}

export interface GotIntelAnim {
  type: "gotIntel";
  player: PlayerID;
  city: string;
  amount: number;
}

export interface ShowPreStrikeZoomAnim {
  type: "showPreStrikeZoom";
  at: string;
}

export interface ShowPreStrikeBullseyeAnim {
  type: "showPreStrikeBullseye";
  at: string[];
}

export interface GotActionAnim {
  type: "gotAction";
  player: PlayerID;
  city: string;
}

export interface EnemyCouldBeHereAnim {
  type: "enemyCouldBeHere";
  at: string;
}

export interface DelayAnim {
  type: "delay";
  seconds: number;
}

export interface ShowAlertAnim {
  type: "showAlert";
  message: string;
  subtitle?: string;
  tapToDismiss: boolean;
}

export type BoardAnimation =
  | StartedKnownActionAnim
  | StartedUnknownActionAnim
  | FinishedSneakyTravelAnim
  | MissedStrikeAnim
  | SuccessfulStrikeAnim
  | RevealDeepCoverAnim
  | BotHeldStrikeAnim
  | CityClosedAnim
  | PlayerRevealedAnim
  | IntelUsedAnim
  | StruckAnim
  | GotIntelAnim
  | ShowPreStrikeZoomAnim
  | ShowPreStrikeBullseyeAnim
  | GotActionAnim
  | EnemyCouldBeHereAnim
  | DelayAnim
  | ShowAlertAnim;

// Helper functions to create animations
export const BoardAnimation = {
  startedKnownAction: (action: Action): StartedKnownActionAnim => ({
    type: "startedKnownAction",
    action,
  }),

  startedUnknownAction: (intelUsed: boolean): StartedUnknownActionAnim => ({
    type: "startedUnknownAction",
    intelUsed,
  }),

  finishedSneakyTravel: (actionsLeft: number, couldBeDeep: boolean): FinishedSneakyTravelAnim => ({
    type: "finishedSneakyTravel",
    actionsLeft,
    couldBeDeep,
  }),

  missedStrike: (wasVisible: boolean): MissedStrikeAnim => ({
    type: "missedStrike",
    wasVisible,
  }),

  successfulStrike: (): SuccessfulStrikeAnim => ({
    type: "successfulStrike",
  }),

  revealDeepCover: (): RevealDeepCoverAnim => ({
    type: "revealDeepCover",
  }),

  botHeldStrike: (): BotHeldStrikeAnim => ({
    type: "botHeldStrike",
  }),

  cityClosed: (cityId: string): CityClosedAnim => ({
    type: "cityClosed",
    cityId,
  }),

  playerRevealed: (player: PlayerID, reason: FatalEvent, onlyToPlayer?: PlayerID): PlayerRevealedAnim => ({
    type: "playerRevealed",
    player,
    reason,
    onlyToPlayer,
  }),

  intelUsed: (operation: string): IntelUsedAnim => ({
    type: "intelUsed",
    operation,
  }),

  struck: (player: PlayerID, city: string | null, playerKilled: boolean): StruckAnim => ({
    type: "struck",
    player,
    city,
    playerKilled,
  }),

  gotIntel: (player: PlayerID, city: string, amount: number): GotIntelAnim => ({
    type: "gotIntel",
    player,
    city,
    amount,
  }),

  showPreStrikeZoom: (at: string): ShowPreStrikeZoomAnim => ({
    type: "showPreStrikeZoom",
    at,
  }),

  showPreStrikeBullseye: (at: string[]): ShowPreStrikeBullseyeAnim => ({
    type: "showPreStrikeBullseye",
    at,
  }),

  gotAction: (player: PlayerID, city: string): GotActionAnim => ({
    type: "gotAction",
    player,
    city,
  }),

  enemyCouldBeHere: (at: string): EnemyCouldBeHereAnim => ({
    type: "enemyCouldBeHere",
    at,
  }),

  delay: (seconds: number): DelayAnim => ({
    type: "delay",
    seconds,
  }),

  showAlert: (message: string, subtitle?: string, tapToDismiss: boolean = true): ShowAlertAnim => ({
    type: "showAlert",
    message,
    subtitle,
    tapToDismiss,
  }),
};
