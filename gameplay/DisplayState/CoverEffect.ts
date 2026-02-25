export enum CoverEffectMarker {
  hidden,
  revealed,
}

export enum CoverEffect {
  gainsCover,
  staysInCover,
  blowsCover,
  stayRevealed,
  mayBlowCover,
}

export namespace CoverEffect {
  export function description(effect: CoverEffect): string {
    switch (effect) {
      case CoverEffect.gainsCover:
        return "You'll gain cover.";
      case CoverEffect.staysInCover:
        return "You'll stay in cover.";
      case CoverEffect.blowsCover:
        return "YOUR COVER WILL BE BLOWN.";
      case CoverEffect.stayRevealed:
        return "Your cover will stay blown.";
      case CoverEffect.mayBlowCover:
        return "YOU MIGHT BLOW YOUR COVER.";
    }
  }

  export function marker(effect: CoverEffect): CoverEffectMarker {
    switch (effect) {
      case CoverEffect.gainsCover:
      case CoverEffect.staysInCover:
        return CoverEffectMarker.hidden;
      case CoverEffect.blowsCover:
      case CoverEffect.stayRevealed:
      case CoverEffect.mayBlowCover:
        return CoverEffectMarker.revealed;
    }
  }
}
