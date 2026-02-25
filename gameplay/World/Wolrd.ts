import { Player } from "./Player";
import { City } from "./City";
import { Move } from "./Move";
import { BoardAnimation } from "../DisplayState/BoardAnimation";
import { PlayerID, otherPlayer } from "./PlayerID";
import { GameSettings, SeedType } from "../GameSettings";
import { CityGraph } from "./CityGraph";
import { Point } from "../Math/Geometry";
import { Connection } from "./Connection";
import XoshiroRNG from "../Math/XoshiroRNG";
import { ChanceController, WeightedOption } from "../Simulation/ChanceController";
import { ClosedState, canEnter } from "./ClosedState";
import { SpiesMap } from "../../blocks/types";
import { BoardState } from "../DisplayState/BoardState";

export class World {
  players: Player[];
  get cities(): City[] {
    return this.cityGraph.cities;
  }
  moveHistory: Move[] = [];
  hasTurnStarted: boolean = false;
  turnNo: number;
  moveNo: number;
  boardNo: number;
  seed: number = -1; // Chosen once per match, persisted
  cityGraph: CityGraph = new CityGraph([], []);
  baseSpeed: number = 2.0;
  gameSettings: GameSettings;
  createdAt: Date = new Date();

  currentTurnAnimations: BoardAnimation[][] = [[], []];
  boardQueue: BoardState[][] = [[], []];

  private turnPlayerId: PlayerID;

  get turnPlayer(): Player {
    if (this.players[this.turnPlayerId] && this.players[this.turnPlayerId].id === this.turnPlayerId) {
      return this.players[this.turnPlayerId];
    }
    console.error("turn player not found", `player with id ${this.turnPlayerId} not found!`);
    throw new Error("Turn player not found");
  }

  set turnPlayer(value: Player) {
    this.turnPlayerId = value.id;
  }

  get nextTurnPlayer(): Player {
    return this.players[otherPlayer(this.turnPlayerId)];
  }

  // MARK: Initializers
  constructor(gameSettings: GameSettings) {
    this.gameSettings = gameSettings;

    // Set seed based on matchSettings
    if (gameSettings.worldSeed === SeedType.random) {
      this.seed = Math.floor(Math.random() * 100000000);
    } else {
      this.seed = gameSettings.worldSeed.value;
    }

    this.turnNo = 0;
    this.moveNo = 0;
    this.boardNo = 0;
    this.players = [];
    this.turnPlayerId = gameSettings.initialTurnPlayer();

    // Load map data
    try {
      // Note: The actual map loading is async, but we're making it sync here for compatibility
      // In a real implementation, you'd want to make this properly async
      this.cityGraph = World.loadMap(gameSettings.mapStructure);

      const startingCities = this.pickStartingCities();

      this.players = [
        new Player(PlayerID.player0, startingCities[0], gameSettings),
        new Player(PlayerID.player1, startingCities[1], gameSettings),
      ];

      // Set ownership for starting cities
      startingCities[0].owner = this.players[0];
      startingCities[1].owner = this.players[1];

      // Players need a back reference to the world to queue animations
      this.players[0].world = this;
      this.players[1].world = this;

      // Players reference one another as their target
      this.players[0].target = this.players[1];
      this.players[1].target = this.players[0];
    } catch (error) {
      console.error("Failed to initialize world", error);
      // In Swift this would throw a fatal error, but we'll just throw a normal error
      throw new Error("Failed to initialize world");
    }
  }

  reconnectAfterLoad(): void {
    for (const player of this.players) {
      player.world = this;
      const city = this.cityGraph.city(player.locationID);
      if (!city) {
        throw new Error(`Failed to find city with ID ${player.locationID}`);
      }
      player.location = city;
      player.target = this.players[otherPlayer(player.id)];
    }

    for (const city of this.cityGraph.cities) {
      if (city.ownerID !== undefined) {
        city.owner = this.players[city.ownerID];
      } else {
        city.owner = undefined;
      }
    }
  }

  recordGameCompleted(winner: PlayerID, nextGameIndex: number): void {
    const firstNullIndex = this.gameSettings.matchHistory.findIndex((win) => win === null);
    if (firstNullIndex !== nextGameIndex) {
      console.error(
        "recordGameCompleted: Next game index does not match the first null index in the match history",
        firstNullIndex,
        nextGameIndex
      );
      return;
    }
    if (firstNullIndex !== -1) {
      this.gameSettings.matchHistory[firstNullIndex] = winner;
    }
  }

  // MARK: Initialization helpers
  private static loadMap(mapStructure: SpiesMap): CityGraph {
    // throw an error if map is empty
    if (mapStructure.cities.length === 0 || mapStructure.cxns.length === 0) {
      throw new Error("Map " + mapStructure.id + " is empty");
    }

    const newCities: City[] = mapStructure.cities.map((city) => {
      const newCity = new City(city.name);
      newCity.x = city.pos.x;
      newCity.y = city.pos.y;

      if (mapStructure.critical && mapStructure.critical.includes(city.name)) {
        newCity.isCritical = true;
      }

      if (mapStructure.bonus && mapStructure.bonus.includes(city.name)) {
        newCity.isBonus = true;
      }

      return newCity;
    });

    const newConnections: Connection[] = mapStructure.cxns.map((connection) => {
      return new Connection(connection.from, connection.to);
    });

    return new CityGraph(newCities, newConnections);
  }

  pickStartingCities(): [City, City] {
    const cityValues = this.calculateCityValuesAsStartingCities();
    const cities = this.cityGraph.cities;

    const mapHasCritical = cities.some((city) => city.isCritical);

    // Rate pairs of cities
    const cityPairChances: WeightedOption<[City, City]>[] = [];

    for (const [city1, value1] of cityValues) {
      for (const [city2, value2] of cityValues) {
        const path = this.cityGraph.findPath(city1, city2);
        if (!path) continue;

        const stepsAway = path.length;

        if (stepsAway <= 2) {
          // Players too close
          continue;
        }

        const maximumDifference = 55.0;
        const firstMoverAdvantage = mapHasCritical ? 140.0 : 35.0; // We should give the second player a better city but overall still worse advantage

        const valueDifference = Math.abs(value1 - value2 + firstMoverAdvantage);

        if (valueDifference >= maximumDifference) {
          // Too different, would be unfair
          continue;
        }

        const scoreMagnifier = 1.5;
        const score = Math.pow(maximumDifference - valueDifference, scoreMagnifier);

        cityPairChances.push({ choice: [city1, city2], chance: Math.floor(score) });
      }
    }

    // Only consider best options
    const maximumChoicesToConsider = 12;

    cityPairChances.sort((a, b) => b.chance - a.chance);
    const bestChoices = cityPairChances.slice(0, maximumChoicesToConsider);

    const chanceController = new ChanceController();
    const chosenPair = chanceController.chooseOptionWithChances(bestChoices, this.seed);

    if (!chosenPair) {
      console.error("Couldn't find valid starting cities choice.");
      throw new Error("Couldn't find valid starting cities choice.");
    }

    return chosenPair;
  }

  calculateCityValuesAsStartingCities(): [City, number][] {
    const citiesWithStartingValues: [City, number][] = [];

    // For every city, calculate its value as a starting city
    for (const fromCity of this.cityGraph.cities) {
      let fromCityValue = 0.0;

      if (fromCity.isClosed) {
        // No value to start in a closed city
        continue;
      }

      // Check the distance to every other city
      for (const toCity of this.cityGraph.cities) {
        const path = this.cityGraph.findPath(fromCity, toCity);
        if (!path) continue;

        const stepsAway = path.length;

        if (stepsAway === 0) {
          // No path to that city, no value add
          continue;
        }

        const valueDecay = 2.2; // The exponent at which further away cities become useless
        const toCityValue = this.cityValue(toCity);

        // Add value with exponential decay for longer distances
        fromCityValue += toCityValue / Math.pow(stepsAway, valueDecay);
      }

      // Store result for later use
      fromCityValue *= 100; // Convert values to an int-range number so they can be used by the die roller later
      citiesWithStartingValues.push([fromCity, fromCityValue]);
    }

    return citiesWithStartingValues;
  }

  private cityValue(city: City): number {
    if (city.isCritical) {
      return 12.0;
    } else if (city.isBonus) {
      return 4.0;
    } else {
      return 1.0;
    }
  }

  city(searchID: string): City {
    for (const city of this.cities) {
      if (city.id === searchID) {
        return city;
      }
    }

    console.error("No city found", `missing city ID ${searchID}`);
    throw new Error(`No city found with ID ${searchID}`);
  }

  citiesByID(searchIDs: string[]): City[] {
    return this.cities.filter((city) => searchIDs.some((id) => id === city.id));
  }

  intelChanceForCity(city: City): number {
    const tooRecentToRepeat = this.turnNo - 2;
    if (city.lastIntelTurn !== undefined && city.lastIntelTurn > tooRecentToRepeat) {
      return 0; // Too recent, no good
    } else if (city.closedState !== 0) {
      // 0 is ClosedState.open
      return 0;
    } else if (city.intelHere >= 50) {
      // too much intel already
      return 0;
    } else if (city.actionHere) {
      // Don't pile intel on an action pickup
      return 0;
    }

    // Don't put intel right on top of a player, or if they only have a small number of possible locations in any of those locations
    for (const player of this.players) {
      // Potential locations does not include the players actual location when revealed.
      if (
        player.location.id === city.id ||
        (player.potentialLocations.size < 4 && player.potentialLocations.has(city.id))
      ) {
        return 0;
      }
    }

    let chance = 5; // baseline

    if (city.intelHere > 0 && city.intelHere < 30) {
      chance += 75;
    }

    if (city.isBonus) {
      chance += 40;
    }

    if (city.owner === undefined) {
      // Bias towards neutral cities
      chance += 5;
      chance *= 3;
    }

    return chance;
  }

  moveHistoryForTurn(turn: number): Move[] {
    return this.moveHistory.filter((move) => move.turnNo === turn);
  }

  // Intel management
  baseIntelSpeedForPlayer(player: Player): number {
    const loadoutMultiplier = player.loadout.intelRate;
    return Math.floor(this.baseSpeed * loadoutMultiplier);
  }

  intelCapacityForCity(city: City, forLoadout: any): number {
    const loadoutMultiplier = forLoadout.intelRate;
    const bonusCityFactor = 4.0;
    const citySpeed = city.isBonus ? loadoutMultiplier * bonusCityFactor : loadoutMultiplier;
    return Math.floor(citySpeed);
  }

  bonusCapacityForCity(city: City, forLoadout: any): number {
    const loadoutMultiplier = forLoadout.intelRate;
    const regularSpeed = Math.floor(loadoutMultiplier);
    return this.intelCapacityForCity(city, forLoadout) - regularSpeed;
  }

  intelSpeedForCity(city: City, andPlayer: Player): number {
    const intelForThisCity = city.owner === andPlayer ? this.intelCapacityForCity(city, andPlayer.loadout) : 0;
    return Math.floor(intelForThisCity);
  }

  totalIntelSpeedForPlayer(player: Player): number {
    const baseSpeed = this.baseIntelSpeedForPlayer(player);

    const totalIntel = this.cities.reduce((total, city) => {
      return total + this.intelSpeedForCity(city, player);
    }, baseSpeed);

    return totalIntel;
  }

  gainIntel(forPlayer: Player): void {
    forPlayer.intel += this.baseIntelSpeedForPlayer(forPlayer);

    for (const city of this.cities) {
      const cityIntel = this.intelSpeedForCity(city, forPlayer);

      if (cityIntel > 0) {
        forPlayer.intel += cityIntel;
        this.queueAnimation({
          type: "gotIntel",
          player: forPlayer.id,
          city: city.id,
          amount: cityIntel,
        });
      }
    }
  }

  // MARK: City management
  generateRandomCityList(ofSize: number, currentCity: City, onlyPossible: boolean = false): City[] {
    let possibleCities: City[] = [...this.cities];
    const opponentPotentialLocations = new Set(this.nextTurnPlayer.potentialLocations);
    opponentPotentialLocations.delete(currentCity.id);

    if (onlyPossible && opponentPotentialLocations.size >= ofSize) {
      possibleCities = this.cities.filter((city) => opponentPotentialLocations.has(city.id));
    }

    // Remove the current city and any closed cities
    possibleCities = possibleCities.filter((city) => !city.isClosed && city.id !== currentCity.id);

    const citiesSeed = this.seed + this.moveHistory.length;
    const die = new XoshiroRNG(citiesSeed);

    // Now remove cities until there are ofSize left
    while (possibleCities.length > ofSize) {
      const dRoll = die.nextInt(possibleCities.length);
      if (dRoll >= 0 && dRoll < possibleCities.length) {
        possibleCities.splice(dRoll, 1);
      }
    }

    return possibleCities;
  }

  addRandomIntel(): void {
    // Add intel to a city
    const intelSeed = this.seed + this.turnNo;

    const percentChanceOfIntelPerTurn = 50;
    const die = new XoshiroRNG(intelSeed);

    const intelExistsSomewhere = this.cities.some((city) => city.intelHere > 0);

    const d100roll = die.nextInt(100);
    const addIntelThisTurn = !intelExistsSomewhere || d100roll < percentChanceOfIntelPerTurn;

    if (!addIntelThisTurn) {
      return;
    }

    const cityIntelChances: WeightedOption<City>[] = [];
    for (const city of this.cities) {
      const chance = this.intelChanceForCity(city);

      if (chance > 0) {
        cityIntelChances.push({ choice: city, chance });
      }
    }

    const seed2 = this.seed + this.turnNo * 100;

    const chanceController = new ChanceController();
    const chosenCity = chanceController.chooseOptionWithChances(cityIntelChances, seed2);

    if (!chosenCity) {
      console.log("WARN: Fell off the end of city loop without choosing a city.");
      return;
    }

    this.players[0].potentialLocations.delete(chosenCity.id);
    this.players[1].potentialLocations.delete(chosenCity.id);

    chosenCity.addIntelPickup(die, this.turnNo);
  }

  openNeighboursForCity(city: City): City[] {
    return this.cityGraph.openNeighbors(city);
  }

  expandPossibleLocations(forPlayer: Player): void {
    forPlayer.potentialLocations = this.expandCities(forPlayer.potentialLocations, forPlayer);
  }

  expandCities(fromPrevious: Set<string>, forPlayer: Player): Set<string> {
    // For every city they could be in, add its neighbours
    const newLocations = new Set(fromPrevious);

    for (const potentialCityID of fromPrevious) {
      const potentialCity = this.city(potentialCityID);
      const neighbours = this.openNeighboursForCity(potentialCity);

      // because you can no longer wait in a controlled city, remove indicators from there
      if (potentialCity.owner !== undefined && potentialCity.owner !== forPlayer && !forPlayer.couldBeInDeepCover) {
        newLocations.delete(potentialCityID);
      }

      for (const neighbour of neighbours) {
        const playerCanHideHere =
          neighbour.owner === undefined || neighbour.owner === forPlayer || forPlayer.couldBeInDeepCover;

        if (!playerCanHideHere) {
          // They can't be here, they would have been revealed
          continue;
        }

        newLocations.add(neighbour.id);
      }
    }

    return newLocations;
  }

  // MARK: Animations
  // Enqueue an animation to be included in the next board state
  queueAnimation(anim: BoardAnimation, playerID?: PlayerID): void {
    if (playerID !== undefined) {
      this.currentTurnAnimations[playerID].push(anim);
    } else {
      this.currentTurnAnimations[0].push(anim);
      this.currentTurnAnimations[1].push(anim);
    }
  }

  lastBoardState(playerID: PlayerID): BoardState {
    return this.boardQueue[playerID][this.boardQueue[playerID].length - 1];
  }

  clearBoardQueue(playerID: PlayerID): void {
    this.boardQueue[playerID] = [];
  }

  clearAnimations(): void {
    this.currentTurnAnimations = [[], []];
  }

  openNeighborsControlledBy(city: City, player?: Player): number {
    return this.openNeighboursForCity(city).filter((neighbor) => neighbor.owner === player).length;
  }

  openNeighborsNotControlledBy(city: City, player?: Player): number {
    return this.openNeighboursForCity(city).filter((neighbor) => neighbor.owner !== player).length;
  }

  openNeighborsThatMayContain(city: City, player: Player): number {
    return this.openNeighboursForCity(city).filter((neighbor) => player.isPotentiallyIn(neighbor)).length;
  }
}
