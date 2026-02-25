export class Connection {
  from: string;
  to: string;

  constructor(from: string, to: string) {
    // sort from and to alphabetically, so identical connections will compare even if they were specified differently
    const sortedConnection = [from, to].sort();
    this.from = sortedConnection[0];
    this.to = sortedConnection[1];
  }
}
