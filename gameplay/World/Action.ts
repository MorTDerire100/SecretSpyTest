export enum Action {
  nothing = "Nothing",
  move = "Move",
  strike = "Strike",
  control = "Control",
  pass = "Pass",
  wait = "Wait",
  deepCover = "DeepCover",
  rapid = "Rapid",
  reveal = "Reveal",
  encryption = "Encryption",
  interrogate = "Interrogate",
  prepareMission = "PrepareMission",
  timedOut = "timedOut",
  unlockStrikeReports = "UnlockStrikeReports",
}

export function isUnlockable(action: Action): boolean {
  switch (action) {
    case Action.encryption:
    case Action.rapid:
    case Action.unlockStrikeReports:
      return true;
    default:
      return false;
  }
}

export function analyticsTitle(action: Action): string | null {
  switch (action) {
    case Action.strike:
      return "Strike";
    case Action.control:
      return "Control";
    case Action.deepCover:
      return "Ready Deep Cover";
    case Action.prepareMission:
      return "Prepare Action";
    case Action.reveal:
      return "Locate Target";
    case Action.rapid:
      return "Rapid Recon";
    case Action.encryption:
      return "Encryption";
    case Action.interrogate:
      return "Interrogate Locals";
    case Action.wait:
      return "Wait";
    case Action.unlockStrikeReports:
      return "Strike Reports";
    case Action.move:
      return "Travels";
    default:
      return null;
  }
}

export function cost(action: Action, abilityCosts: Record<Action, number>): number {
  switch (action) {
    case Action.deepCover:
      return abilityCosts[Action.deepCover];
    case Action.reveal:
      return abilityCosts[Action.reveal];
    case Action.rapid:
      return abilityCosts[Action.rapid];
    case Action.encryption:
      return abilityCosts[Action.encryption];
    case Action.prepareMission:
      return abilityCosts[Action.prepareMission];
    case Action.interrogate:
      return abilityCosts[Action.interrogate];
    case Action.unlockStrikeReports:
      return abilityCosts[Action.unlockStrikeReports];
    default:
      return 0;
  }
}

export function title(action: Action): string {
  switch (action) {
    case Action.strike:
      return "Attempt Strike";
    case Action.pass:
      return "End Turn";
    case Action.control:
      return "Control Informants";
    case Action.deepCover:
      return "Ready Deep Cover";
    case Action.prepareMission:
      return "Prepare Action";
    case Action.reveal:
      return "Locate Target";
    case Action.rapid:
      return "Unlock Rapid Recon";
    case Action.encryption:
      return "Unlock Encryption";
    case Action.interrogate:
      return "Interrogate Locals";
    case Action.wait:
      return "Wait";
    case Action.unlockStrikeReports:
      return "Unlock Strike Reports";
    default:
      return `No title for ${action}`;
  }
}

export function shortTitle(action: Action, unlocked: boolean = false): string {
  switch (action) {
    case Action.strike:
      return "STRIKE";
    case Action.pass:
      return "END TURN";
    case Action.control:
      return "CONTROL";
    case Action.deepCover:
      return "GO DEEP";
    case Action.prepareMission:
      return "PREP";
    case Action.reveal:
      return "LOCATE";
    case Action.interrogate:
      return "INTERR";
    case Action.rapid:
      return unlocked ? "RAPID" : "UNLOCK";
    case Action.encryption:
      return unlocked ? "ENCRYPT" : "UNLOCK";
    case Action.wait:
      return "WAIT";
    case Action.unlockStrikeReports:
      return unlocked ? "REPORT" : "UNLOCK";
    default:
      return "MISSINGNO.";
  }
}

export function usedDescription(action: Action): string {
  switch (action) {
    case Action.deepCover:
      return "used intel to ready deep cover";
    case Action.rapid:
      return "used intel to unlock Rapid Recon";
    case Action.reveal:
      return "used intel to learn your location";
    case Action.encryption:
      return "used intel to unlock Encryption";
    case Action.prepareMission:
      return "used intel to prepare a deadly mission";
    case Action.interrogate:
      return "blew their cover to earn intel";
    case Action.unlockStrikeReports:
      return "used intel to unlock Strike Reports";
    default:
      return "";
  }
}

export function unlockableDescription(action: Action): string {
  switch (action) {
    case Action.rapid:
      return "Unlock so that you can *blow Target's cover* by entering the city they are in.";
    case Action.encryption:
      return "Unlock to *make it secret* which actions you spend intel on.";
    case Action.prepareMission:
      return "Get an *extra action next turn*, enabling very deadly manoeuvres.";
    case Action.deepCover:
      return "Ready deep cover so *your cover can't be blown* until your *next turn* starts.";
    case Action.unlockStrikeReports:
      return "Unlock so *Target's missed strikes* will blow their cover.";
    default:
      return "";
  }
}

export function unlockedDescription(action: Action): string {
  switch (action) {
    case Action.rapid:
      return "Target's cover will be blown when you enter their city.";
    case Action.encryption:
      return "The actions you spend intel on are secret now.";
    case Action.deepCover:
      return "Your cover can't be blown until the end of your next turn.";
    case Action.unlockStrikeReports:
      return "Target's missed strikes will now blow their cover.";
    default:
      return "No description.";
  }
}

export function pdfName(action: Action): string {
  switch (action) {
    case Action.control:
      return "Icon_Control";
    case Action.strike:
      return "Icon_Strike";
    case Action.reveal:
      return "Icon_Reveal";
    case Action.prepareMission:
      return "Icon_Prep";
    case Action.pass:
      return "Icon_GoDeep-Active";
    case Action.rapid:
      return "Icon_RapidRecon";
    case Action.encryption:
      return "Icon_Encryption";
    case Action.deepCover:
      return "Icon_GoDeep";
    case Action.interrogate:
      return "ability-silentsnipe";
    case Action.wait:
      return "Icon_Wait";
    case Action.unlockStrikeReports:
      return "Icon_Reports";
    default:
      return "Icon_Control";
  }
}

export function isIntelUsage(action: Action): boolean {
  switch (action) {
    case Action.reveal:
    case Action.encryption:
    case Action.prepareMission:
    case Action.rapid:
    case Action.interrogate:
    case Action.deepCover:
    case Action.unlockStrikeReports:
      return true;
    default:
      return false;
  }
}

export function isSignalledToTarget(action: Action): boolean {
  return isIntelUsage(action) || action === Action.strike;
}

export function costsActionPoint(action: Action): boolean {
  switch (action) {
    case Action.pass:
    case Action.timedOut:
    case Action.nothing:
      return false;
    default:
      return true;
  }
}
