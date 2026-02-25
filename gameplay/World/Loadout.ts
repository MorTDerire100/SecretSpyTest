import { Action } from "./Action";

export class Loadout {
  intelRate: number = 1.0;
  abilities: Action[] = [
    Action.control,
    Action.strike,
    Action.wait,
    Action.reveal,
    Action.deepCover,
    Action.prepareMission,
    Action.encryption,
    Action.rapid,
    Action.unlockStrikeReports,
  ];
  botDifficulty: number = 2;
  canFakeStrike: boolean = true;
}

export type BotDifficulty = "harmless" | "easy" | "moderate" | "sly";

/**
 * Returns the bot username for a given difficulty level.
 */
export function getBotName(difficulty: BotDifficulty): string {
  switch (difficulty) {
    case "harmless":
      return "TwoSpiesBot_Harmless";
    case "easy":
      return "TwoSpiesBot_Easy";
    case "moderate":
      return "TwoSpiesBot_Moderate";
    case "sly":
      return "TwoSpiesBot_Sly";
  }
}

export function createPresetLoadout(difficulty: BotDifficulty): Loadout {
  const l = new Loadout();
  switch (difficulty) {
    case "harmless": {
      // No intel rates for now, it seems like probably a bug that these were applied to bots, and they should probably be for humans only
      // but should figure out a way to safely restore if we do add human loadouts back in
      //l.intelRate = 0.5;
      l.abilities = [Action.control, Action.strike, Action.wait, Action.reveal, Action.deepCover];
      l.botDifficulty = 0;
      return l;
    }
    case "easy": {
      // No intel rates for now, it seems like probably a bug that these were applied to bots, and they should probably be for humans only
      // but should figure out a way to safely restore if we do add human loadouts back in
      //l.intelRate = 2.0;
      l.abilities = [
        Action.control,
        Action.strike,
        Action.wait,
        Action.deepCover,
        Action.reveal,
        Action.prepareMission,
      ];
      l.botDifficulty = 1;
      l.canFakeStrike = false;
      return l;
    }
    case "sly": {
      l.abilities = [
        Action.control,
        Action.strike,
        Action.wait,
        Action.reveal,
        Action.deepCover,
        Action.prepareMission,
        Action.encryption,
        Action.rapid,
        Action.unlockStrikeReports,
      ];
      l.botDifficulty = 3;
      return l;
    }
    case "moderate":
    default: {
      l.abilities = [
        Action.control,
        Action.strike,
        Action.wait,
        Action.reveal,
        Action.deepCover,
        Action.prepareMission,
        Action.encryption,
        Action.rapid,
        Action.unlockStrikeReports,
      ];
      l.botDifficulty = 2;
      return l;
    }
  }
}
