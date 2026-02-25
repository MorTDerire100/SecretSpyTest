export class BotChoice {
  private name: string;
  private impossible = false;
  private impossibleReason = "";
  private rules: { condition: boolean; adds: number; because: string; atDifficulty?: number }[] = [];
  private multipliers: { condition: boolean; multiplier: number; because: string }[] = [];
  private definite = false;
  private definiteReason = "";

  constructor(name: string) {
    this.name = name;
  }

  impossibleIf(condition: boolean, because: string): void {
    if (condition) {
      this.impossible = true;
      this.impossibleReason = because;
    }
  }

  definiteIf(condition: boolean, because: string): void {
    if (condition) {
      this.definite = true;
      this.definiteReason = because;
    }
  }

  add(value: number, because: string): void {
    this.rule(true, value, because);
  }

  rule(condition: boolean, adds: number, because: string, atDifficulty?: number): void {
    this.rules.push({ condition, adds, because, atDifficulty });
  }

  multiplyIf(condition: boolean, multiplier: number, because: string): void {
    this.multipliers.push({ condition, multiplier, because });
  }

  total(difficulty: number): number {
    if (this.impossible) {
      return 0;
    }

    if (this.definite) {
      return 1000; // High value to ensure it's chosen
    }

    let total = 0;

    // Apply all rules
    for (const rule of this.rules) {
      if (rule.condition) {
        if (rule.atDifficulty === undefined || rule.atDifficulty <= difficulty) {
          total += rule.adds;
        }
      }
    }

    // Apply all multipliers
    for (const multiplier of this.multipliers) {
      if (multiplier.condition) {
        total *= multiplier.multiplier;
      }
    }

    return total;
  }

  get isImpossible(): boolean {
    return this.impossible;
  }

  toString(): string {
    if (this.impossible) {
      return `${this.name} (impossible: ${this.impossibleReason})`;
    }

    if (this.definite) {
      return `${this.name} (definite: ${this.definiteReason})`;
    }

    let result = this.name;
    for (const rule of this.rules) {
      if (rule.condition) {
        result += `\n  +${rule.adds}: ${rule.because}`;
      }
    }
    for (const multiplier of this.multipliers) {
      if (multiplier.condition) {
        result += `\n  *${multiplier.multiplier}: ${multiplier.because}`;
      }
    }
    return result;
  }
}
