import { Action, isUnlockable } from "../World/Action";
import { Player } from "../World/Player";
import { CoverEffect } from "./CoverEffect";
import { Simulation } from "../Simulation/Simulation";

export class DossierDisplayState {
  ability: Action;
  enabled: boolean;
  unlockable: boolean;
  unlocked: boolean;
  cost: number;
  shortTitle: string;
  title: string;
  explanation: string;
  coverBlowing: CoverEffect | undefined;
  disabledReason: string | undefined;
  alertTitle: string | undefined;
  alertMessage: string | undefined;

  constructor(ability: Action, player: Player, simulation: Simulation) {
    this.ability = ability;
    const [statusText, disabledText] = simulation.abilityController.getAbilityStatus(ability, player);

    this.enabled = simulation.abilityController.isActionEnabled(ability, player);
    this.unlockable = isUnlockable(ability);
    this.unlocked = player.isUnlocked(ability);
    this.cost = simulation.abilityController.getAbilityCost(ability);
    this.shortTitle = simulation.abilityController.shortTitleForAction(ability, player);
    this.title = simulation.abilityController.titleForAction(ability, player).toUpperCase();
    this.explanation = statusText;
    this.coverBlowing = simulation.abilityController.getCoverBlowingStatus(ability, player);
    this.disabledReason = disabledText;
    [this.alertTitle, this.alertMessage] = simulation.abilityController.getAbilityAlertTexts(ability, player);
  }
}
