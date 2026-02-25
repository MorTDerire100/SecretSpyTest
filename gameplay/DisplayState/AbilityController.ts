import {
  Action,
  title,
  shortTitle,
  cost,
  unlockableDescription,
  unlockedDescription,
  isSignalledToTarget,
} from "../World/Action";
import { Player } from "../World/Player";
import { CoverEffect } from "./CoverEffect";
import { Simulation } from "../Simulation/Simulation";
import { UnlockVisibility } from "../World/UnlockIndicatorState";

export class AbilityController {
  simulation: Simulation;

  constructor(simulation: Simulation) {
    this.simulation = simulation;
  }

  getAbilityCost(action: Action): number {
    return cost(action, this.simulation.world.gameSettings.abilityCosts);
  }

  getCoverBlowingStatus(ability: Action, player: Player): CoverEffect | undefined {
    if (player.inDeepCover) {
      return undefined;
    }

    const playerIsSuperRevealed = player.isSuperRevealed(player);

    switch (ability) {
      case Action.wait:
        return playerIsSuperRevealed ? CoverEffect.gainsCover : CoverEffect.staysInCover;
      case Action.control:
        return playerIsSuperRevealed ? CoverEffect.stayRevealed : CoverEffect.blowsCover;
      case Action.strike:
        if (playerIsSuperRevealed) {
          return CoverEffect.stayRevealed;
        }

        switch (player.target.strikeReportsVisibility) {
          case UnlockVisibility.visiblyLocked:
            return CoverEffect.staysInCover;
          case UnlockVisibility.visiblyUnlocked:
            return CoverEffect.blowsCover;
          case UnlockVisibility.secretlyLocked:
          case UnlockVisibility.secretlyUnlocked:
            return CoverEffect.mayBlowCover;
        }
        break;
      case Action.unlockStrikeReports:
      case Action.encryption:
      case Action.prepareMission:
      case Action.deepCover:
      case Action.reveal:
        return playerIsSuperRevealed ? CoverEffect.stayRevealed : CoverEffect.staysInCover;
      default:
        return undefined;
    }

    return undefined;
  }

  getAbilityStatus(ability: Action, player: Player): [string, string | undefined] {
    let explanation = "";
    let disabledReason: string | undefined = undefined;

    const unlocked = player.isUnlocked(ability);

    switch (ability) {
      case Action.rapid:
      case Action.encryption:
      case Action.unlockStrikeReports:
        explanation = unlocked ? unlockedDescription(ability) : unlockableDescription(ability);
        break;
      case Action.prepareMission:
        explanation = unlockableDescription(ability);
        break;
      case Action.deepCover:
        [explanation, disabledReason] = this.getDeepCoverStatus(player);
        break;
      case Action.reveal:
        [explanation, disabledReason] = this.getRevealStatus(player);
        break;
      case Action.strike:
        [explanation, disabledReason] = this.getStrikeStatus(player);
        break;
      case Action.control:
        [explanation, disabledReason] = this.getControlStatus(player);
        break;
      case Action.wait:
        [explanation, disabledReason] = this.getWaitStatus(player);
        break;
      case Action.interrogate:
        [explanation, disabledReason] = this.getInterrogateStatus(player);
        break;
      default:
        console.error(`Can't get ability status for ${ability}`);
        break;
    }

    const deepCoverInstr = this.deepCoverInstructions(ability, player);
    if (deepCoverInstr) {
      disabledReason = deepCoverInstr;
    }

    const generalDisabledReason = this.disabledReasonFor(ability, player);
    if (generalDisabledReason) {
      // The more general reasons are more useful
      disabledReason = generalDisabledReason;
    }

    return [explanation, disabledReason];
  }

  getAbilityAlertTexts(ability: Action, player: Player): [string | undefined, string | undefined] {
    let title: string | undefined = undefined;
    let subtitle: string | undefined = undefined;

    switch (ability) {
      case Action.deepCover: {
        const [_, statusSubtitle] = this.getDeepCoverStatus(player);
        title = statusSubtitle;
        break;
      }
      case Action.reveal: {
        const [_, statusSubtitle] = this.getRevealStatus(player);
        title = statusSubtitle;
        break;
      }
      case Action.strike: {
        [title, subtitle] = this.getStrikeAlertTexts(player);
        break;
      }
      case Action.control: {
        const [_, statusSubtitle] = this.getControlStatus(player);
        title = statusSubtitle;
        break;
      }
      case Action.wait: {
        const [_, statusSubtitle] = this.getWaitStatus(player);
        title = statusSubtitle;
        break;
      }
      case Action.interrogate: {
        const [_, statusSubtitle] = this.getInterrogateStatus(player);
        title = statusSubtitle;
        break;
      }
    }

    const deepCoverInstruction = this.deepCoverInstructions(ability, player);
    if (deepCoverInstruction) {
      title = deepCoverInstruction;
      subtitle = undefined;
    }

    const generalAlertDisabledReason = this.disabledReasonFor(ability, player);
    if (generalAlertDisabledReason) {
      // The more general reasons are more useful
      title = generalAlertDisabledReason;
      subtitle = undefined;
    }

    return [title, subtitle];
  }

  titleForAction(action: Action, player: Player): string {
    const targetCouldBeHere = player.target.isPotentiallyIn(player.location);

    if (action === Action.strike && !targetCouldBeHere && player.loadout.canFakeStrike) {
      return "Fake Strike";
    } else {
      return title(action);
    }
  }

  shortTitleForAction(action: Action, player: Player): string {
    const unlocked = player.isUnlocked(action);
    return shortTitle(action, unlocked);
  }

  isActionEnabled(action: Action, player: Player): boolean {
    return this.getAbilityStatus(action, player)[1] === undefined;
  }

  disabledReasonFor(ability: Action, player: Player): string | undefined {
    const abilityCost = this.getAbilityCost(ability);
    const thisPlayersTurn = player === this.simulation.turnPlayer;
    const thisPlayerCanAct = thisPlayersTurn && player.actionsLeft > 0;

    // General reasons you may not be able to act
    if (!thisPlayersTurn) {
      return "Waiting for your turn.";
    } else if (!thisPlayerCanAct && ability !== Action.pass) {
      return "Out of actions - your turn is over.";
    } else if (thisPlayersTurn && this.simulation.turnPlayerMustMove()) {
      return "You must move out of your current city now.";
    } else if (abilityCost > player.intel) {
      // You can't afford this
      return `This needs ${abilityCost} intel.`;
    }
    return undefined;
  }

  deepCoverInstructions(ability: Action, player: Player): string | undefined {
    const isSuperRevealed = player.isSuperRevealed(player.target);
    const inDeepCover = player.inDeepCover;
    const hasOneMove = player.actionsLeft === 1;
    const enemyLocationIsSameAndRevealedForStrike =
      player.target.isSuperRevealed(player) && player.target.location === player.location && ability === Action.strike;

    if (
      !(
        hasOneMove &&
        isSuperRevealed &&
        inDeepCover &&
        isSignalledToTarget(ability) &&
        !enemyLocationIsSameAndRevealedForStrike
      )
    ) {
      return undefined; // Don't disable actions in deep cover unless they would be a clearly bad idea
    }

    return "Wait or move to enter Deep Cover.";
  }

  // Private status getters
  private getBlankStatus(): [string, string | undefined] {
    return ["", undefined];
  }

  private getRevealStatus(player: Player): [string, string | undefined] {
    const description = "*Blow your Target's cover* using intel.";

    if (player.target.isSuperRevealed(player)) {
      return [description, "Your Target's cover is already blown."];
    } else if (player.target.inDeepCover && !player.target.hasEncryption) {
      return [description, "Your opponent is in Deep Cover."];
    } else {
      return [description, undefined];
    }
  }

  private getControlStatus(player: Player): [string, string | undefined] {
    const currentCity = player.location;
    const description = `*Control ${currentCity.name}'s informants*. They will blow Target's cover and gather Intel.`;

    if (player.inDeepCover) {
      return [description, "Can't control while you're in deep cover."];
    }

    if (currentCity.ownerID === player.id) {
      return [description, `You already control ${currentCity.name}.`];
    } else {
      return [description, undefined];
    }
  }

  private getStrikeStatus(player: Player): [string, string | undefined] {
    const currentCity = player.location;
    const description = `Win the operation *if* Target is also in ${currentCity.name}.`;

    if (!player.target.isPotentiallyIn(currentCity)) {
      if (player.loadout.canFakeStrike) {
        return [`Target can't be in ${currentCity.name} – but you can *fake a strike*.`, undefined];
      } else {
        return [description, `Target can't be in ${currentCity.name}.`];
      }
    } else {
      return [description, undefined];
    }
  }

  private getInterrogateStatus(player: Player): [string, string | undefined] {
    let description = "*Sacrifice cover* to earn intel on your next turn.";

    const intelLimit = player.loadout.abilities.includes(Action.interrogate) ? 10 : 5; // Default intel limit

    if (player.intel >= intelLimit) {
      return [description, `Your intel would exceed your limit of ${intelLimit}.`];
    } else {
      return [description, undefined];
    }
  }

  private getWaitStatus(player: Player): [string, string | undefined] {
    const passDescription = "*Gain cover* by doing nothing for this action.";

    if (player.location.isClosed && player.actionsLeft <= 1) {
      return [passDescription, `You must leave ${player.location.name}.`];
    } else if (player.location.owner === player.target && !player.inDeepCover) {
      return [passDescription, "Can't wait in city with enemy informants."];
    } else {
      return [passDescription, undefined];
    }
  }

  private getDeepCoverStatus(player: Player): [string, string | undefined] {
    const deepCoverDescription = unlockableDescription(Action.deepCover);
    const superRevealed = player.isSuperRevealedToSelf();
    const hasOneMove = player.actionsLeft === 1;

    let disabledReason: string | undefined = undefined;
    if (superRevealed && hasOneMove) {
      disabledReason = "Need 2 actions to ready then enter Deep Cover.";
    }
    return [deepCoverDescription, disabledReason];
  }

  private getStrikeAlertTexts(player: Player): [string | undefined, string | undefined] {
    const currentCity = player.location;

    if (!player.target.isPotentiallyIn(currentCity)) {
      if (!player.loadout.canFakeStrike) {
        return [`Target can't be in ${currentCity.name}.`, "Beginner loadouts can't fake strike."];
      }
    }

    return [undefined, undefined];
  }
}
