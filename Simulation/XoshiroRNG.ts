/// A seeded pseudo-random number generator implementation using the Xoshiro256++ algorithm (https://en.wikipedia.org/wiki/Xorshift#xoshiro)
/// "Anyone who considers arithmetical methods of producing random digits is, of course, in a state of sin." - John von Neumann
export default class XoshiroRNG {
  private state: [bigint, bigint, bigint, bigint];
  private static MASK64 = (BigInt(1) << BigInt(64)) - BigInt(1);

  constructor(seed: number) {
    const s = this.splitmix64(BigInt(seed));
    this.state = [s[0], s[1], s[2], s[3]];
  }

  public next(): bigint {
    const result = (this.rotateLeft(this.state[0] + this.state[3], 23) + this.state[0]) & XoshiroRNG.MASK64;
    const t = (this.state[1] << BigInt(17)) & XoshiroRNG.MASK64;

    this.state[2] ^= this.state[0];
    this.state[3] ^= this.state[1];
    this.state[1] ^= this.state[2];
    this.state[0] ^= this.state[3];

    this.state[2] ^= t;
    this.state[3] = this.rotateLeft(this.state[3], 45);

    return result;
  }

  public nextInt(upperBound: number): number {
    if (upperBound === 0) {
      throw new Error("upperBound cannot be zero.");
    }

    const bound = BigInt(upperBound);
    let random = this.next();
    let m = random * bound;
    let low = m & XoshiroRNG.MASK64;

    if (low < bound) {
      const t = -bound % bound;
      while (low < t) {
        random = this.next();
        m = random * bound;
        low = m & XoshiroRNG.MASK64;
      }
    }

    return Number(m >> BigInt(64));
  }

  private rotateLeft(x: bigint, k: number): bigint {
    const shift = BigInt(k);
    return ((x << shift) | ((x & XoshiroRNG.MASK64) >> (BigInt(64) - shift))) & XoshiroRNG.MASK64;
  }

  /// Churn an incoming seed, to make "bad" seeds with lots of zeros less dangerous
  private splitmix64(seed: bigint): [bigint, bigint, bigint, bigint] {
    let z = (seed + BigInt("0x9E3779B97F4A7C15")) & XoshiroRNG.MASK64;

    const mix = (): bigint => {
      z = (z + BigInt("0x9E3779B97F4A7C15")) & XoshiroRNG.MASK64;
      let result = z;
      result = ((result ^ (result >> BigInt(30))) * BigInt("0xBF58476D1CE4E5B9")) & XoshiroRNG.MASK64;
      result = ((result ^ (result >> BigInt(27))) * BigInt("0x94D049BB133111EB")) & XoshiroRNG.MASK64;
      return (result ^ (result >> BigInt(31))) & XoshiroRNG.MASK64;
    };

    const s0 = mix();
    const s1 = mix();
    const s2 = mix();
    const s3 = mix();

    return [s0, s1, s2, s3];
  }
}
