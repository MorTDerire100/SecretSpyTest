export class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  equals(other: Point): boolean {
    return this.x === other.x && this.y === other.y;
  }

  distanceToPoint(other: Point): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export class Rect {
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get origin(): Point {
    return new Point(this.x, this.y);
  }

  get size(): Size {
    return new Size(this.width, this.height);
  }

  equals(other: Rect): boolean {
    return this.x === other.x && this.y === other.y && this.width === other.width && this.height === other.height;
  }
}

export class Size {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  equals(other: Size): boolean {
    return this.width === other.width && this.height === other.height;
  }
}
