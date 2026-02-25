import { ClosedState, canEnter } from "./ClosedState";
import { PlayerID } from "./PlayerID";
import { Player } from "./Player";
import XoshiroRNG from "../Math/XoshiroRNG";

export class City {
  // Properties
  id: string;
  sortOrder: number = 0;
  closedState: ClosedState = ClosedState.open;
  turnsUntilClosed?: number;
  isBonus: boolean = false;
  isCritical: boolean = false; // AI assistance for strategical lynchpins
  x: number = 0;
  y: number = 0;
  intelHere: number = 0;
  lastIntelTurn?: number;
  actionHere: boolean = false;

  private _ownerID?: PlayerID;
  private _owner?: Player;

  get ownerID(): PlayerID | undefined {
    return this._ownerID;
  }

  get owner(): Player | undefined {
    return this._owner;
  }

  set owner(value: Player | undefined) {
    this._owner = value;
    this._ownerID = value?.id;
  }

  get pickupValue(): number {
    const actionIntelValue = 40; // How much intel is an action pickup equivalent to?
    return this.intelHere + (this.actionHere ? actionIntelValue : 0);
  }

  get name(): string {
    return this.id;
  }

  // Initializers
  constructor(cityId: string) {
    this.id = cityId;
  }

  // Instance Methods
  addIntelPickup(die: XoshiroRNG, forTurnNo: number): void {
    console.log(`Putting intel in ${this.name}.`);
    const amountOptions = [10, 15];

    const intelAlreadyHere = this.intelHere > 0;
    if (intelAlreadyHere) {
      // Consider adding an action here
      const actionPercentage = 40;
      const actionRoll = die.nextInt(100);
      if (actionRoll < actionPercentage) {
        // Add an action here
        this.actionHere = true;
        this.intelHere = 0;
        return;
      }
    }

    const addSizeChoice = die.nextInt(amountOptions.length - 1);
    const addAmount = amountOptions[addSizeChoice];
    this.intelHere += addAmount;
    this.lastIntelTurn = forTurnNo;
  }

  get isOpen(): boolean {
    return canEnter(this.closedState);
  }

  get isClosed(): boolean {
    return !canEnter(this.closedState);
  }

  equals(other: City): boolean {
    return this.id === other.id;
  }
}
