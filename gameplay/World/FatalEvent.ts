export enum FatalEvent {
  sameCityEndTurn,
  sameCityStartTurn,
  sameCityDeepCover,
  enemyTerritory,
  revealedByControl,
  rapidReconFinder,
  rapidReconFound,
  failedStrike,
  intelPickup,
  extraActionKill,
  actionPickup,
  controlled,
  remoteReveal,
  firstTurn,
  killedByStrike,
  prepareMission,
  interrogate,
  concede,
}

export function getDescription(event: FatalEvent): string {
  switch (event) {
    case FatalEvent.sameCityStartTurn:
    case FatalEvent.sameCityEndTurn:
    case FatalEvent.sameCityDeepCover:
      return "Same city as target";
    case FatalEvent.enemyTerritory:
      return "Enemy territory";
    case FatalEvent.revealedByControl:
      return "Revealed by control";
    case FatalEvent.rapidReconFinder:
    case FatalEvent.rapidReconFound:
      return "Rapid Reconnaissance";
    case FatalEvent.failedStrike:
      return "Failed strike";
    case FatalEvent.intelPickup:
      return "Picking up intel";
    case FatalEvent.actionPickup:
      return "Picking up action";
    case FatalEvent.extraActionKill:
      return "Killed with extra action";
    case FatalEvent.controlled:
      return "Controlling city";
    case FatalEvent.remoteReveal:
      return "Remote Reveal";
    case FatalEvent.firstTurn:
      return "First turn.";
    case FatalEvent.killedByStrike:
      console.error("Don't set the last fatal event as Killed");
      return "";
    case FatalEvent.prepareMission:
      return "Prepared Mission";
    case FatalEvent.interrogate:
      return "Interrogate";
    case FatalEvent.concede:
      return "Concede";
  }
}

export function revealString(event: FatalEvent, isLoadedPlayer: boolean): string {
  switch (event) {
    case FatalEvent.sameCityStartTurn:
    case FatalEvent.sameCityDeepCover:
      return `when ${isLoadedPlayer ? "your target" : "you"} *ended ${isLoadedPlayer ? "their" : "your"} turn* here.`;
    case FatalEvent.sameCityEndTurn:
      return `when ${isLoadedPlayer ? "you" : "they"} *ended ${isLoadedPlayer ? "your" : "their"} turn* here`;
    case FatalEvent.enemyTerritory:
      return "*by informants* here.";
    case FatalEvent.rapidReconFinder:
    case FatalEvent.rapidReconFound:
      return "here with *Rapid Recon*.";
    case FatalEvent.failedStrike:
      return "*striking unsuccessfully* here.";
    case FatalEvent.intelPickup:
      return "*picking up intel* here.";
    case FatalEvent.actionPickup:
      return "*picking up an action* here.";
    case FatalEvent.controlled:
      return "*controlling* informants here.";
    case FatalEvent.remoteReveal:
      return "here using *Locate*.";
    case FatalEvent.firstTurn:
      return "starting the operation here.";
    case FatalEvent.interrogate:
      return "by interrogating the locals.";
    case FatalEvent.concede:
      return "by conceding.";
    default:
      return "here recently.";
  }
}

export function winExplanation(event: FatalEvent, winnerName: string, loserName: string): string {
  switch (event) {
    case FatalEvent.sameCityStartTurn:
    case FatalEvent.sameCityEndTurn:
      return `u/${loserName} was caught ending their turn in the same city as u/${winnerName}.`;
    case FatalEvent.sameCityDeepCover:
      return `u/${loserName} was caught ending their turn in the same city as u/${winnerName}, who was undercover.`;
    case FatalEvent.enemyTerritory:
      return `u/${loserName} was caught in enemy territory.`;
    case FatalEvent.revealedByControl:
      return `u/${loserName} was revealed by an untimely Control.`;
    case FatalEvent.rapidReconFinder:
      return `u/${loserName} was revealed by Rapid Reconnaissance.`;
    case FatalEvent.rapidReconFound:
      return `u/${loserName} was found by Rapid Reconnaissance.`;
    case FatalEvent.failedStrike:
      return `u/${loserName} was caught by a failed strike, revealing them.`;
    case FatalEvent.intelPickup:
      return `u/${loserName} was caught picking up intel, revealing them.`;
    case FatalEvent.actionPickup:
      return `u/${loserName} was caught picking up an extra action, revealing them.`;
    case FatalEvent.extraActionKill:
      return `u/${winnerName} used an extra action pickup to hunt down u/${loserName}.`;
    case FatalEvent.controlled:
      return `u/${winnerName} got word of u/${loserName} controlling informants, and found them.`;
    case FatalEvent.remoteReveal:
      return `u/${winnerName} remotely located u/${loserName} and struck them somehow.`;
    case FatalEvent.firstTurn:
      return `u/${winnerName} found u/${loserName} on the first turn. How distasteful.`;
    case FatalEvent.killedByStrike:
      console.error("Don't set the last fatal event as Killed");
      return "";
    case FatalEvent.prepareMission:
      return `u/${winnerName} found u/${loserName} on an expertly prepared mission!`;
    case FatalEvent.interrogate:
      return `Interrogating the locals revealed u/${loserName}.`;
    case FatalEvent.concede:
      return `u/${loserName} conceded the match.`;
  }
}

export function deathExplanation(event: FatalEvent): string {
  switch (event) {
    case FatalEvent.sameCityStartTurn:
    case FatalEvent.sameCityEndTurn:
      return "You ended your turn in the same city as Target.";
    case FatalEvent.sameCityDeepCover:
      return "You ended your turn in the same city as Target, who was undercover.";
    case FatalEvent.enemyTerritory:
      return "Your foray into enemy territory was ill fated.";
    case FatalEvent.revealedByControl:
      return "Your target found you with Control.";
    case FatalEvent.rapidReconFinder:
      return "Using rapid reconnaissance revealed you, and Target tracked you down.";
    case FatalEvent.rapidReconFound:
      return "Target found you with Rapid Reconnaissance.";
    case FatalEvent.failedStrike:
      return "Your failed strike revealed you, marking your demise.";
    case FatalEvent.intelPickup:
      return "Picking up intel revealed you, and Target tracked you down.";
    case FatalEvent.actionPickup:
      return "Picking up an action revealed you, and Target tracked you down.";
    case FatalEvent.extraActionKill:
      return "Target used an action pickup to hunt you down.";
    case FatalEvent.controlled:
      return "Target got word of you controlling informants, and found you.";
    case FatalEvent.remoteReveal:
      return "Target remotely located you, and somehow killed you that way.";
    case FatalEvent.firstTurn:
      return "Target found you on the first turn. How distasteful.";
    case FatalEvent.killedByStrike:
      console.error("Don't set the last fatal event as Killed");
      return "";
    case FatalEvent.prepareMission:
      return "Target found you on an expertly prepared mission!";
    case FatalEvent.interrogate:
      return "Interrogating the locals revealed you, and Target tracked you down.";
    case FatalEvent.concede:
      return "You conceded.";
  }
}
