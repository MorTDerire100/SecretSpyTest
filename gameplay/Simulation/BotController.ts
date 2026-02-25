import { Simulation } from "./Simulation";
import { Player } from "../World/Player";
import { World } from "../World/World";
import { Action } from "../World/Action";
import { City } from "../World/City";
import { BoardAnimation } from "../DisplayState/BoardAnimation";
import { Move } from "../World/Move";
import { ChanceController } from "./ChanceController";
import { BotChoice } from "./BotChoice";
import { canEnter } from "../World/ClosedState";
import { UnlockVisibility } from "../World/UnlockIndicatorState";
import { AbilityController } from "../DisplayState/AbilityController";

export class BotController {
  simulation: Simulation;
  abilityController: AbilityController;
  private lastTurnHeldStrike = 0;

  constructor() {
    this.simulation = {} as Simulation;
    this.abilityController = new AbilityController(this.simulation);
  }

  get isDumb(): boolean {
    return this.turnPlayer.loadout.botDifficulty <= 1;
  }

  get isBlind(): boolean {
    return this.turnPlayer.loadout.botDifficulty === 0;
  }

  get strikeIsActive(): boolean {
    return true; // TODO: was false for first part of tutorial
  }

  get isFirstTutorialRound(): boolean {
    return false; // TODO: leaving stubbed so we still could enable tutorial bot
  }

  private get turnPlayer(): Player {
    return this.simulation.turnPlayer;
  }

  private get nextTurnPlayer(): Player {
    return this.simulation.nextTurnPlayer;
  }

  private get world(): World {
    return this.simulation.world;
  }

  takeTurn(): void {
    this.queueAction();
  }

  queueAction(): void {
    const botActionSpeed = this.isFirstTutorialRound ? 4.0 : 2.0;
    this.world.queueAnimation(BoardAnimation.delay(botActionSpeed));
    this.takeAction();
  }

  canSomeoneTravel(from: City, to: City, actions: number): boolean {
    const path = this.world.cityGraph.findPath(from, to);
    if (!path) {
      return false;
    }

    // "to" city is included in list, so uses count - 1 actions
    return path.length - 1 <= actions;
  }

  targetCouldStrike(striker: Player, strikeCity: City, startCity: City, ignoringStrikeback: boolean): boolean {
    if (ignoringStrikeback && strikeCity === startCity) {
      // They'd be dead
      return false;
    }

    const travelsPossible = 1 + striker.publicBonusActionsNextTurn + (startCity.actionHere ? 1 : 0); // If there's an action here, they'll pick it up and get a bonus

    return this.canSomeoneTravel(startCity, strikeCity, travelsPossible);
  }

  targetIsDefinitelyIn(city: City): boolean {
    const targetIsSuperRevealed = this.nextTurnPlayer.isSuperRevealed(this.turnPlayer);
    const targetIsHere = this.nextTurnPlayer.location === city;

    return targetIsSuperRevealed && targetIsHere;
  }

  magicTargetIsBeside(city: City): boolean {
    for (const neighbor of this.world.openNeighboursForCity(city)) {
      if (neighbor === this.nextTurnPlayer.location) {
        return true;
      }
    }
    return false;
  }

  magicGettingRevealedInCurrentCityWillKillYou(): boolean {
    return this.magicTargetIsBeside(this.turnPlayer.location) && this.turnPlayer.actionsLeft === 1;
  }

  canUseAction(action: Action): boolean {
    // if the action is wait (which is always available) or if the bot's selected loadout includes this action
    return action === Action.wait || this.turnPlayer.loadout.abilities.includes(action);
  }

  private pickAction(): Move | undefined {
    // Evaluate the bot's options
    const allBotOptions: { choice: Move; chance: number }[] = [];

    const actionsToWeigh: Action[] = [
      Action.strike,
      Action.wait,
      Action.control,
      Action.deepCover,
      Action.rapid,
      Action.encryption,
      Action.reveal,
      Action.prepareMission,
      Action.unlockStrikeReports,
    ];

    for (const action of actionsToWeigh) {
      if (!this.canUseAction(action) || this.simulation.turnPlayerMustMove()) {
        continue; // You can't use this action, or you have to travel
      }

      const actionChoice = new Move(this.turnPlayer.id, null, action);
      const choiceResult = this.choice(action);
      const diff = this.turnPlayer.loadout.botDifficulty;
      const thisOption = { choice: actionChoice, chance: choiceResult.total(diff) };

      allBotOptions.push(thisOption);
    }

    const currentCityValue = this.travelChoice(this.turnPlayer.location, undefined).total(
      this.turnPlayer.loadout.botDifficulty
    );

    for (const city of this.world.openNeighboursForCity(this.turnPlayer.location)) {
      if (currentCityValue === 1.0) {
        // You're definitely staying
        continue;
      }

      const moveChoice = new Move(this.turnPlayer.id, city.id, Action.move);
      const cityValue = this.travelChoice(city, currentCityValue).total(this.turnPlayer.loadout.botDifficulty);
      const thisOption = { choice: moveChoice, chance: cityValue };

      allBotOptions.push(thisOption);
    }

    const bestBotOptions = allBotOptions.filter((option) => option.chance > 0);

    // note: only used for logging
    for (const option of bestBotOptions) {
      console.log(this.debugDescriptionFor(option.choice, option.chance));
    }

    const chanceController = new ChanceController();
    let bestChosenOption = chanceController.chooseOptionWithChances(bestBotOptions, this.world.seed);
    const possibleBotOptions = allBotOptions.filter((option) => option.chance !== 0);

    // unable to choose a good option, pick a fallback
    if (!bestChosenOption && possibleBotOptions.length > 0) {
      bestChosenOption = possibleBotOptions[0].choice;
    }

    return bestChosenOption;
  }

  executeChoice(chosenMove: Move): void {
    const ability = chosenMove.action;

    switch (ability) {
      case Action.move:
        if (!chosenMove.cityID) {
          console.error("Bot tried to move to a non-city.");
          return;
        }

        console.log(
          `## BOT DECIDED TO MOVE to city ${this.world.city(chosenMove.cityID).name} from ${this.turnPlayer.location.name}`
        );
        this.simulation.turnPlayerTravel(chosenMove.cityID);
        this.simulation.captureBoard("bot moved");
        this.queueAction();
        break;
      default:
        console.log(`## BOT DECIDED TO ${chosenMove.action} from ${this.turnPlayer.location.name}`);
        this.simulation.turnPlayerDoAction(ability);

        // don't queue up another action if you pass
        if (ability !== Action.pass) {
          this.simulation.captureBoard("bot took action");
          this.queueAction();
        } else {
          this.simulation.captureBoard("bot ended turn");
        }
    }
  }

  choice(action: Action): BotChoice {
    switch (action) {
      case Action.strike:
        return this.strikeChoice(this.turnPlayer.location);
      case Action.wait:
        return this.waitChoice();
      case Action.control:
        return this.controlChoice();
      case Action.deepCover:
      case Action.prepareMission:
      case Action.rapid:
      case Action.encryption:
      case Action.reveal:
      case Action.unlockStrikeReports:
        return this.spendIntelChoice(action);
      default:
        const notFoundChoice = new BotChoice(`No handler: ${action}`);
        notFoundChoice.impossibleIf(true, "No evaluator for action.");
        return notFoundChoice;
    }
  }

  private takeAction(): void {
    if (this.nextTurnPlayer.isDead) {
      console.log("## Other player is dead.");
      return;
    }

    if (this.turnPlayer.actionsLeft <= 0) {
      console.log("## Bot out of actions - passing.");
      this.passTurn();
      return;
    }

    const chosenMove = this.pickAction();
    if (!chosenMove) {
      console.error("Bot was unable to pick any option.");
      return;
    }
    this.executeChoice(chosenMove);
  }

  private passTurn(): void {
    this.executeChoice(new Move(this.turnPlayer.id, null, Action.pass));
  }

  private debugDescriptionFor(move: Move, chance: number): string {
    return `Bot option: ${move.action} with chance ${chance}`;
  }

  private neutralsOpen(): number {
    return this.world.cities.filter((city) => canEnter(city.closedState) && city.owner === null).length;
  }

  private neighboursQualityFor(city: City, player: Player): number {
    // Get the total quality of this place's neighbours
    return this.world
      .openNeighboursForCity(city)
      .map((neighbor) => this.simpleCityQuality(neighbor, player))
      .reduce((sum, quality) => sum + quality, 0);
  }

  private simpleCityQuality(city: City, player: Player): number {
    // For simple consideration if a target wants to be here
    let cityValue = this.world.openNeighboursForCity(city).length / 2;

    if (city.actionHere) {
      cityValue += 5.0;
    }

    cityValue += city.intelHere / 10.0;

    if (city.isBonus) {
      cityValue += 6.0;
    }

    if (city.isCritical) {
      cityValue += 8.0;
    }

    if (city.owner !== player) {
      cityValue += 2.0;

      if (player.couldBeInDeepCover && city.owner !== null) {
        // This could be stealable by them
        cityValue *= 2.0;
      }
    }

    // Smart bots consider if opponent just struck
    if (
      player !== this.turnPlayer &&
      this.targetLastAction() === Action.strike &&
      this.turnPlayer.loadout.botDifficulty >= 3 &&
      city.owner !== player
    ) {
      // Add extra "quality" to account for the fact that they're especially likely to have struck in a good city
      cityValue *= 2;
    }

    return cityValue;
  }

  private chanceTargetIsHere(city: City): number {
    if (!this.nextTurnPlayer.isPotentiallyIn(city)) {
      // Couldn't be here at all
      return 0.0;
    }

    const thisCityQuality = this.simpleCityQuality(city, this.nextTurnPlayer);

    if (this.nextTurnPlayer.potentialLocations.size === 0) {
      // If potential locations is empty, can't continue because we will divide by zero below.
      console.error("Potential locations unexpectedly empty");
      return 0;
    }

    const potentialCitiesQualitySum = Array.from(this.nextTurnPlayer.potentialLocations)
      .map((cityId) => this.world.city(cityId))
      .map((city) => this.simpleCityQuality(city, this.nextTurnPlayer))
      .reduce((sum, quality) => sum + quality, 0);

    return thisCityQuality / potentialCitiesQualitySum;
  }

  private chanceTargetCanStrikeHere(city: City, ignoringStrikeback: boolean = false): number {
    // Consider the chance this city is within your enemy's striking range
    let qualitySum = 0.01;
    let dangerSum = 0.0;

    for (const potentialCityId of this.nextTurnPlayer.potentialLocations) {
      const potentialCity = this.world.city(potentialCityId);
      const qualityForTarget = this.simpleCityQuality(potentialCity, this.nextTurnPlayer);
      const canStrikeFromHere = this.targetCouldStrike(this.nextTurnPlayer, city, potentialCity, ignoringStrikeback);

      qualitySum += qualityForTarget;

      if (canStrikeFromHere) {
        dangerSum += qualityForTarget; // Count danger in proportion to how much target wants to be there
      }
    }

    const riskAvg = dangerSum / qualitySum; // Average danger

    if (riskAvg <= 0.01) {
      return 0.0; // Avoid floating point errors
    }

    return riskAvg;
  }

  private targetLastAction(): Action {
    // Assumes target took the last turn, since it's turnPlayer's turn now
    let history = this.world.moveHistoryForTurn(this.world.turnNo - 1);
    history = history.filter((move) => move.action !== Action.pass);
    return history[history.length - 1]?.action ?? Action.pass;
  }

  private targetCanDefinitelyStrike(city: City): boolean {
    return this.chanceTargetCanStrikeHere(city) > 0.99; // Accommodate float error
  }

  private deepCoverChoice(): BotChoice {
    const coverHere = new BotChoice("Deep Cover");

    coverHere.impossibleIf(this.turnPlayer.actionsLeft <= 1, "Only bother if you can move after");
    coverHere.impossibleIf(this.turnPlayer.inDeepCover, "Already in deep cover");

    // It's more valuable to ready deep cover if there are targets to move into
    let neighbourValue = 0;
    for (const city of this.world.openNeighboursForCity(this.turnPlayer.location)) {
      if (city.owner === this.nextTurnPlayer) {
        neighbourValue += 15;
      }
    }

    coverHere.rule(neighbourValue > 0, neighbourValue, "Number of enemy controlled neighbours");

    return coverHere;
  }

  private strikeReportsChoice(): BotChoice {
    const choice = new BotChoice("Strike Reports");

    choice.impossibleIf(this.turnPlayer.hasStrikeReports, "Can't get strike reports twice");

    const neutrals = this.neutralsOpen();

    choice.add(10, "Strike reports is quite useful for the bot");
    choice.rule(neutrals > 0, neutrals * 7, "Strike reports value with " + neutrals + " neutrals", 3);

    return choice;
  }

  private rapidReconChoice(): BotChoice {
    const rapid = new BotChoice("Rapid Recon");

    rapid.impossibleIf(this.turnPlayer.hasRapidRecon, "Can't get rapid recon twice");
    rapid.rule(true, 40, "Rapid recon is good for the bot", 3);

    return rapid;
  }

  private encryptionChoice(): BotChoice {
    const choice = new BotChoice("Encryption");

    choice.impossibleIf(this.turnPlayer.hasEncryption, "Can't get encryption twice");
    choice.add(15, "Encryption isn't as good until the bot can smartly use it");
    choice.rule(
      !this.turnPlayer.hasRapidRecon,
      15,
      "Encryption is better if it prevents them from knowing you have rapid recon"
    );

    return choice;
  }

  private prepChoice(): BotChoice {
    const prep = new BotChoice("Prep Mission");

    prep.add(20, "Prep is great!");
    prep.rule(this.turnPlayer.bonusActionsNextTurn > 0, 20, "Double prep is great");
    prep.rule(this.turnPlayer.hasRapidRecon, 25, "Prep is better with Rapid Recon");
    prep.rule(this.isDumb, -25, "Dumb bots aren't as good at prepping");

    return prep;
  }

  private locateChoice(): BotChoice {
    const locate = new BotChoice("Locate");

    locate.impossibleIf(
      this.nextTurnPlayer.isSuperRevealed(this.turnPlayer),
      "Can't locate when you already know their location"
    );
    locate.impossibleIf(this.turnPlayer.actionsLeft <= 1, "Only locate if you have additional actions");
    locate.rule(this.turnPlayer.hasEncryption, 10, "Enjoy locating under encryption", 3);

    locate.impossibleIf(this.nextTurnPlayer.couldBeInDeepCover, "Don't locate if they might have deep cover");

    const locateInstaKillFactor = this.chanceTargetCanStrikeHere(this.turnPlayer.location) * 400;
    locate.rule(
      this.turnPlayer.actionsLeft > 2,
      locateInstaKillFactor,
      "Using extra action is great proportional to proximity",
      3
    );
    locate.rule(this.isDumb, 20, "Dumb bots like Locate more");

    return locate;
  }

  private spendIntelChoice(action: Action): BotChoice {
    let intelChoice = new BotChoice("Spend Intel on " + action);

    intelChoice.impossibleIf(
      this.abilityController.getAbilityCost(action) > this.turnPlayer.intel,
      "Not enough intel (" + this.turnPlayer.intel + ")"
    );
    intelChoice.impossibleIf(this.isBlind, "Blind bot doesn't spend intel");

    if (intelChoice.isImpossible) {
      return intelChoice; // Already impossible
    }

    switch (action) {
      case Action.prepareMission:
        intelChoice = this.prepChoice();
        break;
      case Action.deepCover:
        intelChoice = this.deepCoverChoice();
        break;
      case Action.rapid:
        intelChoice = this.rapidReconChoice();
        break;
      case Action.reveal:
        intelChoice = this.locateChoice();
        break;
      case Action.encryption:
        intelChoice = this.encryptionChoice();
        break;
      case Action.unlockStrikeReports:
        intelChoice = this.strikeReportsChoice();
        break;
      default:
        // Not handling this as intel spending
        intelChoice.impossibleIf(true, "No handler for this intel spend");
        return intelChoice;
    }

    // Avoid spending intel when super-revealed
    const isSuperRevealed = this.turnPlayer.isSuperRevealed(this.nextTurnPlayer);

    intelChoice.rule(this.turnPlayer.actionsLeft === 1, -25, "Avoid spending intel on last action");
    intelChoice.multiplyIf(
      isSuperRevealed && this.turnPlayer.actionsLeft <= 2,
      0.5,
      "Avoid spending intel when super-revealed"
    );

    intelChoice.multiplyIf(this.turnPlayer.intel > 65, 2.0, "Try to spend intel when you have lots");

    intelChoice.multiplyIf(this.isDumb, 0.5, "Dumb bots spend less intel");

    return intelChoice;
  }

  private controlChoice(): BotChoice {
    const city = this.turnPlayer.location;
    const controlHere = new BotChoice("Control " + this.turnPlayer.location.name);

    controlHere.impossibleIf(this.turnPlayer.location.owner === this.turnPlayer, "You already own here");
    controlHere.impossibleIf(this.turnPlayer.inDeepCover, "Not allowed in deep cover");

    if (this.isBlind) {
      controlHere.rule(city.owner !== this.nextTurnPlayer, 60, "Tendency to control un-owned cities when blind");
      controlHere.rule(
        city.owner !== this.nextTurnPlayer &&
          this.strikeIsActive &&
          this.magicGettingRevealedInCurrentCityWillKillYou(),
        75,
        "Blind bot loves to get struck in a city you don't own"
      );
      controlHere.rule(city.owner === this.nextTurnPlayer, 10, "Blind bot less likely to control opponent's city");
      controlHere.rule(
        city.owner === this.nextTurnPlayer &&
          this.strikeIsActive &&
          this.magicGettingRevealedInCurrentCityWillKillYou(),
        15,
        "Blind bot is willing to get struck in a city you own"
      );

      return controlHere;
    }

    const targetWillKillYou = this.turnPlayer.actionsLeft === 1 && this.targetCanDefinitelyStrike(city);
    controlHere.impossibleIf(targetWillKillYou, "Target will kill you for this");
    controlHere.impossibleIf(this.targetIsDefinitelyIn(city), "Never worth doing");

    controlHere.add(10, "Bias toward controlling");
    controlHere.rule(city.isBonus, 30, "City is bonus");
    controlHere.rule(city.isCritical, 30, "City is chokepoint");

    const intelDesire = 0.5;
    const intelFactor = this.turnPlayer.location.pickupValue * intelDesire;
    controlHere.rule(intelFactor > 0, intelFactor, "Pickup value here");

    controlHere.rule(city.owner === this.nextTurnPlayer, 30, "Enemy city", 2);

    // Consider the neighbourhood
    const controlledNeighborsValue = this.world.openNeighborsControlledBy(city, this.turnPlayer) * 4.0;
    controlHere.add(controlledNeighborsValue, "You control neighbors");

    const deathDangerFactor = -95.0;
    const deathChance = this.chanceTargetCanStrikeHere(city);
    const deathRisk = deathDangerFactor * deathChance;

    const youMayDie = this.turnPlayer.actionsLeft === 1 && deathRisk !== 0;
    controlHere.rule(youMayDie, deathRisk, "Target may kill you for control (x" + deathChance + ")", 2);
    controlHere.rule(
      deathChance > 0.15,
      (deathChance - 0.15) * -200,
      "Target is likely to kill you for control (x" + deathChance + ")",
      3
    );

    const controlIsSafe = !youMayDie;
    controlHere.rule(controlIsSafe, 50, "Totally safe", 2);

    const youStartedRevealed = this.turnPlayer.isSuperRevealed(this.nextTurnPlayer) && this.turnPlayer.actionsLeft > 1;
    controlHere.rule(youStartedRevealed, 30, "You started revealed");

    return controlHere;
  }

  private travelChoice(city: City, currentCityValue?: number): BotChoice {
    const travelVerb = currentCityValue !== undefined ? "Travel to " : "Compare to";
    const travelHere = new BotChoice(travelVerb + " " + city.name);

    travelHere.impossibleIf(city.isClosed, "City is closed");
    travelHere.impossibleIf(this.turnPlayer.location === city && currentCityValue !== undefined, "Already here");

    const youCanKillThemHere = this.targetIsDefinitelyIn(city) && this.turnPlayer.actionsLeft > 1;

    const yourNeighborsCount = this.world.openNeighborsControlledBy(city, this.turnPlayer);
    const zoneControlBonus = yourNeighborsCount * 2.0;

    travelHere.rule(city.owner !== this.turnPlayer, zoneControlBonus, "City would add to contiguous zone");

    if (this.isBlind) {
      travelHere.rule(city.owner === null, 20, "Blind bot likes neutral cities");
      travelHere.rule(this.turnPlayer.location.owner === this.turnPlayer, 10, "Blind bot leaves own cities");
      travelHere.rule(this.nextTurnPlayer.isPotentiallyIn(city), 5, "Blind bot wants to get closer to the opponent");
      travelHere.rule(this.turnPlayer.actionsLeft === 2, 10, "Blind bot prefers to move on first turn");

      const targetAlreadyNearby = this.magicTargetIsBeside(this.turnPlayer.location);
      if (this.strikeIsActive) {
        const alreadyHere = currentCityValue !== undefined;
        travelHere.definiteIf(youCanKillThemHere && !alreadyHere, "Active blind tries to mock-win");
        travelHere.rule(
          targetAlreadyNearby && this.turnPlayer.actionsLeft === 1,
          -7,
          "Active blind bot likes ending turn nearby"
        );
        travelHere.rule(this.magicTargetIsBeside(city), 20, "Blind bot likes moving nearby");
      } else {
        travelHere.impossibleIf(this.nextTurnPlayer.location === city, "Passive blind doesn't aggress you");
        travelHere.rule(targetAlreadyNearby, 5, "Passive blind bot stays away");
      }

      const targetWouldFindYouHere = this.nextTurnPlayer.location === city && this.turnPlayer.actionsLeft === 1;

      // Don't make their first kill a .sameCity kill
      travelHere.impossibleIf(
        this.isFirstTutorialRound && targetWouldFindYouHere,
        "Don't stumble into them before they've had a kill"
      );

      return travelHere;
    }

    // Bot isn't blind
    travelHere.definiteIf(youCanKillThemHere, "You can kill them here");

    const targetRevealed = this.nextTurnPlayer.isSuperRevealed(this.turnPlayer);
    // Check if you have enough actions to hunt them down from here
    const couldStrikeViaHere = this.canSomeoneTravel(
      city,
      this.nextTurnPlayer.location,
      this.turnPlayer.actionsLeft - 2
    );

    travelHere.rule(targetRevealed && couldStrikeViaHere, 10000, "You can kill them via this route");

    const willRevealYou = city.owner === this.nextTurnPlayer && !this.turnPlayer.inDeepCover;
    const revealWillGetYouKilled =
      willRevealYou && this.turnPlayer.actionsLeft === 1 && this.targetCanDefinitelyStrike(city);

    const wasRecentlyRevealed = this.turnPlayer.getReveal(this.turnPlayer) !== undefined;
    travelHere.rule(!wasRecentlyRevealed, -20.0, "Don't wander unless recently revealed");

    travelHere.rule(this.simulation.turnPlayerMustMove(), 250, "Current city is closing");

    const targetKillingYouChance = willRevealYou ? this.chanceTargetCanStrikeHere(city) : 0.0;
    const safeToBeRevealedHere = targetKillingYouChance === 0 || this.turnPlayer.actionsLeft > 1;
    const couldKillYouFactor = targetKillingYouChance * -140.0;

    const bordersSafeTerritory = this.world.openNeighborsNotControlledBy(city, this.nextTurnPlayer) >= 1;

    travelHere.rule(!safeToBeRevealedHere, couldKillYouFactor, "Enemy territory reveal could kill you", 2);

    // Poking enemy cities with rapid recon leads to kills
    const canRapidPoke =
      this.turnPlayer.hasRapidRecon &&
      this.turnPlayer.actionsLeft > 1 &&
      this.nextTurnPlayer.isPotentiallyIn(city) &&
      bordersSafeTerritory &&
      !this.nextTurnPlayer.couldBeInDeepCover;
    travelHere.rule(canRapidPoke, 15, "Could poke here for a rapid recon kill", 2);

    const mayDieFromSameCity =
      this.turnPlayer.actionsLeft === 1 && this.nextTurnPlayer.isPotentiallyIn(city) && !this.turnPlayer.inDeepCover;
    const targetHereChance = this.chanceTargetIsHere(city);
    travelHere.rule(
      mayDieFromSameCity,
      -60 * targetHereChance,
      "Enemy may be here and kill you chance " + targetHereChance
    );
    travelHere.rule(
      mayDieFromSameCity && targetHereChance > 0.1,
      -200 * (targetHereChance - 0.1),
      "Enemy fairly likely to be here and kill you",
      3
    );

    travelHere.rule(
      this.turnPlayer.actionsLeft > 1 && !willRevealYou && targetHereChance > 0.1,
      100 * (targetHereChance - 0.1),
      "Looks like good place to strike them",
      3
    );

    const intelDesire = 0.75;
    const intelValue = city.pickupValue * intelDesire;

    travelHere.rule(intelValue > 0, intelValue, "Pickup value here");

    // Generic reasons to move
    travelHere.rule(city.owner === null, 8, "Neutral city");
    travelHere.rule(city.isBonus && city.owner !== this.turnPlayer, 10, "Bonus city to get");
    travelHere.rule(city.isBonus && city.owner === this.turnPlayer, 5, "Bonus city to protect");
    travelHere.rule(city.isCritical && city.owner !== this.nextTurnPlayer, 30, "Non-hostile chokepoint");

    const neighbourQualityFactor = this.neighboursQualityFor(city, this.turnPlayer) * 0.4;
    travelHere.rule(true, neighbourQualityFactor, "Visit cities with good neighbours", 2);

    const neighborsValue = (this.world.openNeighborsControlledBy(city, this.turnPlayer) - 2.0) * 2.5;
    travelHere.rule(city.owner !== this.turnPlayer, neighborsValue, "Well-connected cities are good to control");

    const borderCitiesCount = this.world.openNeighborsNotControlledBy(city, this.turnPlayer);
    travelHere.add(borderCitiesCount, "Border cities here");

    const canSafeControl =
      city.owner !== this.turnPlayer && this.chanceTargetCanStrikeHere(city) === 0 && this.turnPlayer.actionsLeft > 1;
    travelHere.multiplyIf(canSafeControl, 1.5, "Could safely control city");

    const deepInYourTerritory = borderCitiesCount === 0 && city.owner === this.turnPlayer;
    travelHere.rule(deepInYourTerritory, -12, "City is deep in your territory");

    travelHere.rule(this.turnPlayer.location.actionHere, -20, "Leaving an action to be picked up is dangerous");

    travelHere.rule(canSafeControl && city.owner === this.nextTurnPlayer, 15, "Safely steal enemy city", 2);
    travelHere.rule(!canSafeControl && city.owner === this.nextTurnPlayer, -15, "Reveals you with no safe steal", 2);

    // Suppress wandering when you're already in a city you don't control
    travelHere.multiplyIf(
      this.turnPlayer.location.owner !== this.turnPlayer,
      0.5,
      "You're already in a controllable city"
    );

    if (currentCityValue !== undefined) {
      // We're comparing to your current city
      const stayPut = currentCityValue * -1.0;
      travelHere.add(stayPut, "Appeal of staying in " + this.turnPlayer.location.name);
    }

    const shouldLeaveOwnedCity =
      this.turnPlayer.location.owner === this.turnPlayer &&
      this.turnPlayer.location.pickupValue === 0 &&
      currentCityValue !== undefined;

    const restlessnessFactor = this.turnPlayer.loadout.botDifficulty > 2 ? 5 : 15;
    travelHere.rule(shouldLeaveOwnedCity, restlessnessFactor, "Avoid resting in a controlled city");
    travelHere.rule(revealWillGetYouKilled, -1000, "They'll kill you after you're revealed here");

    return travelHere;
  }

  private strikeChoice(city: City): BotChoice {
    const strikeHere = new BotChoice("Strike in " + city.name);

    const targetCanBeHere = this.nextTurnPlayer.isPotentiallyIn(this.turnPlayer.location);
    const bothPlayersHidden =
      !this.turnPlayer.isSuperRevealedToSelf() && !this.nextTurnPlayer.isSuperRevealed(this.turnPlayer);

    const slyBotConsidersFakeStrike =
      this.turnPlayer.loadout.botDifficulty >= 3 && bothPlayersHidden && this.turnPlayer.actionsLeft === 1;
    const noTargetFactor = slyBotConsidersFakeStrike ? -10 : -200;
    strikeHere.rule(!targetCanBeHere, noTargetFactor, "Target can't be here - only useful for faking");

    const youCanWin = this.targetIsDefinitelyIn(this.turnPlayer.location);

    if (this.isBlind) {
      const magicYouCanWin = this.turnPlayer.location === this.nextTurnPlayer.location;
      strikeHere.impossibleIf(magicYouCanWin, "Blind bot doesn't strike to win");

      if (youCanWin && this.lastTurnHeldStrike < this.world.turnNo) {
        // Notify the player they would have died
        this.world.queueAnimation(BoardAnimation.botHeldStrike());
        this.lastTurnHeldStrike = this.world.turnNo; // Ensure pop is only shown once per turn
      }

      // Make the bot likely to strike if the opponent is not in the city
      strikeHere.rule(!magicYouCanWin, 100, "Blind bots tendency to strike when there is no chance to win");

      strikeHere.rule(
        this.nextTurnPlayer.strikeReportsVisibility !== UnlockVisibility.visiblyUnlocked &&
          this.magicGettingRevealedInCurrentCityWillKillYou(),
        40,
        "Blind bot wants to get struck"
      );
      return strikeHere;
    }

    strikeHere.definiteIf(youCanWin, "Bot can win by striking");

    const successChance = this.chanceTargetIsHere(city);
    strikeHere.rule(true, successChance * 200, "Strike may succeed chance " + successChance, 2);
    strikeHere.rule(successChance > 0.4, (successChance - 0.4) * 600, "Striking has a high success chance!", 3);

    const deathChance = this.chanceTargetCanStrikeHere(city, true);
    const deathDangerFactor = deathChance * -40;

    const neighboursFactor = this.neighboursQualityFor(city, this.nextTurnPlayer) * 0.75;
    strikeHere.rule(true, neighboursFactor, "Striking with good neighbours " + neighboursFactor, 3);

    const youMayDie = this.turnPlayer.actionsLeft === 1 && deathDangerFactor !== 0;
    strikeHere.rule(youMayDie, deathDangerFactor, "They may be able to strike back (chance " + deathChance + ")", 2);
    strikeHere.rule(
      youMayDie && this.turnPlayer.isSuperRevealed(this.turnPlayer),
      deathDangerFactor * 3,
      "Finishing with a revealed strike is a gambit",
      3
    );

    const dumbBotCanMiss = this.isDumb && this.nextTurnPlayer.location !== city;
    strikeHere.rule(dumbBotCanMiss, 15, "Dumb bot likes to miss");

    const isSafe = deathChance === 0.0 || this.turnPlayer.actionsLeft > 1;
    strikeHere.rule(isSafe, 10, "Totally safe", 2);

    strikeHere.multiplyIf(
      this.turnPlayer.loadout.botDifficulty >= 2 &&
        this.nextTurnPlayer.strikeReportsVisibility === UnlockVisibility.visiblyUnlocked,
      0.3,
      "Smart bots more cautious under Strike Reports"
    );

    return strikeHere;
  }

  private waitChoice(): BotChoice {
    const city = this.turnPlayer.location;
    const waitHere = new BotChoice("Wait in " + city.name);

    waitHere.impossibleIf(this.turnPlayer.actionsLeft > 1, "Waiting is useless on first action");
    waitHere.impossibleIf(
      city.owner === this.nextTurnPlayer && !this.turnPlayer.inDeepCover,
      "Waiting in enemy city isn't allowed without deep cover"
    );

    const youAreSuperRevealed = this.turnPlayer.isSuperRevealed(this.nextTurnPlayer);
    const targetCanStrikeHere = this.targetCanDefinitelyStrike(this.turnPlayer.location);

    const youllDie = youAreSuperRevealed && targetCanStrikeHere && city.owner === this.nextTurnPlayer;
    waitHere.rule(youllDie, this.isBlind ? -500 : -10000, "They'll still be able to see you and you'll die.");

    const borderCitiesCount = this.world.openNeighborsNotControlledBy(city, this.turnPlayer);
    waitHere.add(borderCitiesCount * 2, "Border cities here");

    waitHere.rule(city.owner === null, 3, "Neutral city");

    waitHere.rule(city.pickupValue > 0, city.pickupValue / 2, "Pickup value here");
    waitHere.rule(city.isBonus, 15, "Bonus cities are good bases");

    const neighbourQualityFactor = this.neighboursQualityFor(city, this.turnPlayer) * 1.0;
    waitHere.rule(true, neighbourQualityFactor, "Loiter in cities with good neighbours", 1);

    const chanceTargetHere = this.chanceTargetIsHere(city);
    waitHere.rule(
      chanceTargetHere > 0,
      chanceTargetHere * -80,
      "Target might be here (chance: " + chanceTargetHere + ")",
      2
    );

    const targetMightBeNearby = this.chanceTargetCanStrikeHere(city) > 0;
    waitHere.rule(targetMightBeNearby && city.owner === null, 5, "Safer to control this next turn", 2);

    waitHere.rule(city.owner === null && this.turnPlayer.actionsLeft === 1, 5, "Sneakier to control this next turn", 3);

    const wasRecentlyRevealed = this.turnPlayer.getReveal(this.turnPlayer) !== undefined;
    const chanceTargetCanStrike = this.chanceTargetCanStrikeHere(city);
    const getStruckChanceFactor = chanceTargetCanStrike * 40;

    const waitingForCoverUseful = wasRecentlyRevealed && chanceTargetHere < 0.01 && this.turnPlayer.actionsLeft === 1;
    waitHere.rule(
      waitingForCoverUseful,
      getStruckChanceFactor,
      "Recently revealed, target nearby " + chanceTargetCanStrike + ", safe to wait",
      3
    );

    return waitHere;
  }
}
