import { World } from "../World/World";
import { City } from "../World/City";
import { BoardAnimation } from "../DisplayState/BoardAnimation";
import { Point } from "../Math/Geometry";
import { ClosedState } from "../World/ClosedState";
import { ChanceController } from "./ChanceController";

export class CityClosingController {
  private world: World;
  private readonly turnsBeforeClosingCities: number;

  constructor(world: World) {
    this.world = world;
    const numCitiesAtStart = world.cities.filter((city) => city.closedState !== ClosedState.fromBeginning).length;
    this.turnsBeforeClosingCities = Math.floor(numCitiesAtStart / 2) + 2;
  }

  cityClosingPass(): void {
    if (!this.world.gameSettings.closeCities) {
      return;
    }

    // Age city closing
    for (const lastTurnClosedCity of this.world.cities.filter(
      (city) => city.closedState === ClosedState.closedLastTurn
    )) {
      lastTurnClosedCity.closedState = ClosedState.closed;
    }

    for (const justClosedCity of this.world.cities.filter((city) => city.closedState === ClosedState.justClosed)) {
      justClosedCity.closedState = ClosedState.closedLastTurn;
      justClosedCity.intelHere = 0;
      justClosedCity.actionHere = false;
    }

    const closingTurn = this.world.turnNo - this.turnsBeforeClosingCities;
    if (closingTurn >= 0) {
      const cityToClose = this.findNextCityToClose();

      switch (closingTurn % 3) {
        case 0:
          console.log(`impending closure of city in 2 turns: ${cityToClose?.name ?? "Unknown"}`);
          if (cityToClose) {
            cityToClose.closedState = ClosedState.warning;
            cityToClose.turnsUntilClosed = 2;
          }
          break;
        case 1:
          console.log(`impending closure of city in 1 turn: ${cityToClose?.name ?? "Unknown"}`);
          if (cityToClose) {
            cityToClose.turnsUntilClosed = 1;
          }
          break;
        case 2:
          console.log(`closing city: ${cityToClose?.name ?? "Unknown"}`);
          this.closeNextCity();
          break;
      }
    }
  }

  closeNextCity(): void {
    const city = this.findNextCityToClose();
    if (city) {
      city.closedState = ClosedState.justClosed;
      this.world.queueAnimation(BoardAnimation.cityClosed(city.id));
    }
  }

  private findNextCityToClose(): City | undefined {
    // If a city is already in the warning phase, always choose that same city
    const warningCity = this.world.cities.find((city) => city.closedState === ClosedState.warning);
    if (warningCity) {
      return warningCity;
    }

    // Otherwise, calculate chance of each city closing
    const openCities = this.world.cities.filter((city) => city.closedState === ClosedState.open);
    const openCityCount = openCities.length;
    const minimumCities = 1;

    if (openCityCount <= minimumCities) {
      // Don't close any cities if too many are already closed
      return undefined;
    }

    const articulations = this.world.cityGraph.articulationCities(); // Can't close these
    const center = this.centerOfCities();
    const closingCityChoices: { choice: City; chance: number }[] = [];

    let bestCitySoFar: City | undefined;
    let bestChanceSoFar = Number.MIN_SAFE_INTEGER;

    for (const city of openCities) {
      // don't close a city if it breaks the graph
      if (articulations.includes(city)) {
        continue;
      }

      const closeChance = this.calculateCloseChance(city, center);
      const cityChoice = { choice: city, chance: closeChance };

      if (closeChance > bestChanceSoFar) {
        bestCitySoFar = cityChoice.choice;
        bestChanceSoFar = cityChoice.chance;
      }

      if (closeChance > 0) {
        closingCityChoices.push(cityChoice);
      }
    }

    if (closingCityChoices.length === 0) {
      // Always return *something*, even if all the choices aren't good
      return bestCitySoFar;
    }

    const chanceController = new ChanceController();
    return chanceController.chooseOptionWithChances(closingCityChoices, this.world.seed);
  }

  private centerOfCities(): Point {
    // Find average x/y of all open cities
    let counted = 0;
    let x = 0;
    let y = 0;

    for (const city of this.world.cities) {
      if (city.closedState !== ClosedState.fromBeginning) {
        counted++;
        x += city.x;
        y += city.y;
      }
    }

    return new Point(x / counted, y / counted);
  }

  private calculateCloseChance(city: City, center: Point): number {
    let chance = 0; // Base chance

    // Give more chance to cities away from center
    const point = new Point(city.x, city.y);
    const distanceFromCenter = point.distanceToPoint(center);
    const distanceStrength = 0.1;
    const distancePower = 1.1;
    const distanceEffect = Math.pow(distanceFromCenter, distancePower) * distanceStrength;
    chance += Math.floor(distanceEffect);

    // Give more chance to cities with fewer connections
    const neighbours = this.world.cityGraph.openNeighbors(city);
    if (neighbours.length < 1) {
      console.error(`Evaluating closing a city with no connections: ${city.name} has no connections`);
      return 0;
    }

    // Prefer to close isolated cities
    chance += this.closingPenaltyForConnections(neighbours.length);

    const isolations = neighbours.map((neighbour) => this.isolationAfterRemoving(city, neighbour));

    const penaltyTotal = isolations.reduce((sum, isolation) => sum + this.closingPenaltyForIsolation(isolation), 0);

    chance -= penaltyTotal;

    // Bonus cities should avoid closing
    if (city.isBonus) {
      chance = Math.floor(chance / 2);
    }
    return chance;
  }

  private closingPenaltyForConnections(neighbourCount: number): number {
    switch (neighbourCount) {
      case 5:
        return -250;
      case 4:
        return -50;
      case 3:
        return 0;
      case 2:
        return 50;
      case 1:
        return 200;
      default:
        console.error("Can't calculate isolation for city with <1 connections");
        return 0;
    }
  }

  private closingPenaltyForIsolation(severity: number): number {
    switch (severity) {
      case 0:
        return 0; // no spurs, no penalty
      case 1:
        return 10; // 1-length spur, minor penalty
      case 2:
        return 25; // Makes a loop, avoid this
      default:
        return 100; // Makes 2-length spur, worst case
    }
  }

  private isolationAfterRemoving(city: City, neighbour: City): number {
    // Consider how isolated neighbour would be if the proposed city was removed
    const resultingNeighbours = this.neighboursExcluding(neighbour, city);

    if (resultingNeighbours.length > 2) {
      // Wouldn't be isolated
      return 0;
    }

    if (resultingNeighbours.length === 2) {
      // Won't be a spur, but check for it making a loop
      // For example for London and Amsterdam when consider closing Stockholm in the Roundabout map
      for (const resultingNeighbour of resultingNeighbours) {
        if (this.neighboursExcluding(resultingNeighbour, city).length <= 2) {
          // A chain of two 2-neighbour cities means that this would make a loop
          // We'll consider this moderate severity
          return 2;
        }
      }

      // No loop, no problems here
      return 0;
    }

    // Check for 1 neighbour case
    if (resultingNeighbours.length === 1) {
      const resultingNeighbour = resultingNeighbours[0];
      // This city would be on a spur
      // A city is on a 1-spur if it only has one neighbour, who has more than 2 neighbours
      // A city is on a 2-spur if it only has one neighbour, who only has 2 neighbours

      const secondaryCount = this.neighboursExcluding(resultingNeighbour, city).length;

      if (secondaryCount > 2) {
        // The neighbour would have multiple paths out, making this a simple shallow spur
        return 1;
      } else {
        // The neighbour would only have one path out, making this a bad 2+ long spur
        return 3;
      }
    }

    // Removing the proposed city would strand neighbour, so it would be arbitrarily isolated
    return Number.MAX_SAFE_INTEGER;
  }

  private neighboursExcluding(city: City, removedCity: City): City[] {
    return this.world.cityGraph.openNeighbors(city).filter((neighbour) => neighbour !== removedCity);
  }
}
