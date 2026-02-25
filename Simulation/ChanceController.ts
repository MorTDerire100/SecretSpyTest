import XoshiroRNG from "../Math/XoshiroRNG";

export interface WeightedOption<T> {
  choice: T;
  chance: number;
}

export class ChanceController {
  chooseOptionWithChances<T>(options: WeightedOption<T>[], rollSeed: number): T | undefined {
    if (options.length === 0) {
      return undefined;
    }

    const rng = new XoshiroRNG(rollSeed);

    // Calculate total weight and ensure all chances are integers
    const totalWeight = options.reduce((sum, option) => sum + Math.floor(option.chance), 0);

    if (totalWeight <= 0) {
      return undefined;
    }

    // Get a random value between 0 and totalWeight
    const roll = rng.nextInt(totalWeight);

    // Find the option that corresponds to the roll
    let currentWeight = 0;
    for (const option of options) {
      currentWeight += Math.floor(option.chance);
      if (roll < currentWeight) {
        return option.choice;
      }
    }

    // Fallback to the last option (should not normally happen)
    return options[options.length - 1].choice;
  }
}
