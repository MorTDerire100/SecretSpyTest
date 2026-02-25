import { World } from "./World";
import { Player, RecordStat } from "./Player";
import { GameSettings, SeedType, CustomSeedType } from "../GameSettings";
import { PerPlayer } from "./PerPlayer";
import { Loadout } from "./Loadout";
import { PlayerID } from "./PlayerID";
import { Move } from "./Move";
import { CityGraph } from "./CityGraph";
import { City } from "./City";
import { Action } from "./Action";
import { BoardAnimation } from "../DisplayState/BoardAnimation";

function deserializeCityGraph(data: any): CityGraph {
  const cities = data.cities.map((cityData: any) => {
    const city = new City(cityData.id);
    city.x = cityData.x;
    city.y = cityData.y;
    city.closedState = cityData.closedState;
    city.isBonus = cityData.isBonus;
    city.isCritical = cityData.isCritical;
    city.intelHere = cityData.intelHere;
    city.actionHere = cityData.actionHere;
    city.lastIntelTurn = cityData.lastIntelTurn;

    // Set the private ownerID directly, reconnectAfterLoad will fix owner
    (city as any)._ownerID = cityData._ownerID;

    return city;
  });

  const connections = data.connections.map((connData: any) => ({
    from: connData.from,
    to: connData.to,
  }));

  return new CityGraph(cities, connections);
}

function deserializePlayer(data: any, world: World): Player {
  // Create player with just the essential properties
  const city = world.city(data._locationID);
  const playerID = data.id === 0 ? PlayerID.player0 : PlayerID.player1;
  const player = new Player(playerID, city, world.gameSettings);

  // Set public properties
  player.potentialLocations = new Set<string>(
    Array.isArray(data.potentialLocations) ? data.potentialLocations.map((id: any) => String(id)) : []
  );
  player.intel = data.intel;
  player.didPickUpIntelThisTurn = data.didPickUpIntelThisTurn;
  player.didPickUpActionThisTurn = data.didPickUpActionThisTurn;
  player.wasInDeepCover = data.wasInDeepCover;
  player.encryptedActions = data.encryptedActions;
  player.isDead = data.isDead;
  player.hasEncryption = data.hasEncryption;

  player.rapidReconUnlockVisibility = data.rapidReconUnlockVisibility;
  player.deepCoverUnlockVisibility = data.deepCoverUnlockVisibility;
  player.strikeReportsVisibility = data.strikeReportsVisibility;

  player.actionsLeft = data.actionsLeft;
  player.hasBeenRevealedThisTurn = data.hasBeenRevealedThisTurn;
  player.bonusActionsNextTurn = data.bonusActionsNextTurn;
  player.publicBonusActionsNextTurn = data.publicBonusActionsNextTurn;
  player.preparedMission = data.preparedMission;
  player.isBot = data.isBot;

  // Properly deserialize recordedStats
  if (data.recordedStats) {
    player.recordedStats = new Map<RecordStat, number>();
    Object.entries(data.recordedStats).forEach(([key, value]) => {
      player.recordedStats.set(Number(key) as RecordStat, Number(value));
    });
  }

  if (data.lastFatalEvent !== undefined) {
    player.lastFatalEvent = data.lastFatalEvent;
  }

  // deserialize some private variables by hacking the mainframe
  (player as any).revealToSelf = data.revealToSelf;
  (player as any).revealToTarget = data.revealToTarget;
  (player as any)._couldBeInDeepCover = data._couldBeInDeepCover;

  return player;
}

function deserializeMove(data: any): Move {
  return new Move(data.playerID, data.cityID, data.action as Action, data.turnNo, data.moveNo);
}

function deserializeGameSettings(data: any): GameSettings {
  const settings = new GameSettings();

  // Deserialize PerPlayer properties
  const loadout0 = new Loadout();
  const loadout1 = new Loadout();
  if (data.loadout && data.loadout.storage) {
    if (data.loadout.storage[0]) {
      loadout0.intelRate = data.loadout.storage[0].intelRate;
      loadout0.abilities = data.loadout.storage[0].abilities;
      loadout0.botDifficulty = data.loadout.storage[0].botDifficulty;
      loadout0.canFakeStrike = data.loadout.storage[0].canFakeStrike;
    }
    if (data.loadout.storage[1]) {
      loadout1.intelRate = data.loadout.storage[1].intelRate;
      loadout1.abilities = data.loadout.storage[1].abilities;
      loadout1.botDifficulty = data.loadout.storage[1].botDifficulty;
      loadout1.canFakeStrike = data.loadout.storage[1].canFakeStrike;
    }
  }
  settings.loadout = new PerPlayer<Loadout>(loadout0, loadout1);

  settings.name = new PerPlayer<string>(data.name.storage[0], data.name.storage[1]);
  settings.isBot = new PerPlayer<boolean>(data.isBot.storage[0], data.isBot.storage[1]);
  settings.initialIntel = new PerPlayer<number>(data.initialIntel.storage[0], data.initialIntel.storage[1]);
  if (data.playerNames && data.playerNames.storage) {
    settings.playerNames = new PerPlayer<string>(data.playerNames.storage[0], data.playerNames.storage[1]);
  }

  // Deserialize other properties
  settings.mapStructure = data.mapStructure;

  // Handle worldSeed which can be either SeedType.random or CustomSeedType
  if (data.worldSeed === SeedType.random) {
    settings.worldSeed = SeedType.random;
  } else {
    settings.worldSeed = new CustomSeedType(data.worldSeed.value);
  }

  settings.closeCities = data.closeCities;
  settings.isRanked = data.isRanked;
  settings.isTutorial = data.isTutorial;
  settings.abilityCosts = data.abilityCosts;
  settings.matchHistory = data.matchHistory ?? [];

  return settings;
}

export function deserializeWorld(jsonString: string): World {
  // Parse the JSON string into a raw object
  const data = JSON.parse(jsonString);

  // Create a new World with the deserialized match settings
  var settings: GameSettings;
  if (data.gameSettings != undefined) {
    settings = deserializeGameSettings(data.gameSettings);
  } else {
    // TODO: just leaving this in for compatability so we can load old matches right after merging this,
    // can remove in a few days/weeks
    settings = deserializeGameSettings(data.matchSettings);
  }
  const world = new World(settings);

  // Copy over all the basic properties
  world.moveHistory = data.moveHistory.map(deserializeMove);
  world.hasTurnStarted = data.hasTurnStarted;
  world.seed = data.seed;
  world.cityGraph = deserializeCityGraph(data.cityGraph);
  world.baseSpeed = data.baseSpeed;
  world.createdAt = new Date(data.createdAt);

  // TODO: I think this is okay to just copy across, because these are pure data types
  // so the raw JS objects and TS types should be compatable, but I'm not 100% sure
  world.currentTurnAnimations = data.currentTurnAnimations;

  world.turnNo = data.turnNo;
  world.moveNo = data.moveNo;
  world.boardNo = data.boardNo;
  world.players = data.players.map((playerData: any) => deserializePlayer(playerData, world));

  // Set turn player based on the serialized data
  const turnPlayerId = data.turnPlayerId === 0 ? PlayerID.player0 : PlayerID.player1;
  world.turnPlayer = world.players[turnPlayerId];

  if (data.boardQueue !== undefined) {
    world.boardQueue = data.boardQueue;
  } else {
    world.boardQueue = [[], []];
  }

  // Reconnect circular references
  world.reconnectAfterLoad();

  return world;
}
