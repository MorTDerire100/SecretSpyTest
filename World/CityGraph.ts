import { City } from "./City";
import { Connection } from "./Connection";

class CityNode {
  city: City;
  parent?: CityNode;
  costSoFar: number; // Cost from start to current node

  constructor(city: City, parent?: CityNode, costSoFar: number = Number.MAX_SAFE_INTEGER) {
    this.city = city;
    this.parent = parent;
    this.costSoFar = costSoFar;
  }
}

export class CityGraph {
  cities: City[];
  private connections: Connection[];

  constructor(cities: City[], connections: Connection[]) {
    this.cities = cities;
    this.connections = connections;

    for (const city of this.cities) {
      city.sortOrder = this.cities.indexOf(city);
    }
  }

  neighbors(of: City): City[] {
    return this.connections
      .map((connection) => {
        if (connection.from === of.id) {
          return this.city(connection.to);
        }
        if (connection.to === of.id) {
          return this.city(connection.from);
        }
        return null;
      })
      .filter((city): city is City => city !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  city(id: string): City | undefined {
    return this.cities.find((city) => city.id === id);
  }

  openNeighbors(of: City): City[] {
    return this.neighbors(of).filter((city) => city.isOpen);
  }

  findPath(from: City, to: City): City[] | null {
    if (from.isClosed || to.isClosed) {
      return null;
    }

    if (from.equals(to)) {
      return [from];
    }

    // Initialize open and closed sets
    const openSet = new Set<CityNode>();
    const closedSet = new Set<CityNode>();

    // Dictionary to keep track of the best node for each city
    const nodeMap = new Map<string, CityNode>();

    // Initialize the start node
    const startNode = new CityNode(from, undefined, 0);
    openSet.add(startNode);
    nodeMap.set(from.id, startNode);

    while (openSet.size > 0) {
      // Find the node with the lowest cost in the open set
      let current: CityNode | null = null;
      let lowestCost = Number.MAX_SAFE_INTEGER;

      for (const node of openSet) {
        if (node.costSoFar < lowestCost) {
          lowestCost = node.costSoFar;
          current = node;
        }
      }

      if (!current) {
        return null;
      }

      // If we've reached the end, reconstruct and return the path
      if (current.city.equals(to)) {
        return this.reconstructPath(current);
      }

      // Move current node from open to closed set
      openSet.delete(current);
      closedSet.add(current);

      // Check all connections from the current city
      for (const neighbor of this.openNeighbors(current.city)) {
        // Create or retrieve the neighbor node
        let neighborNode = nodeMap.get(neighbor.id);

        if (!neighborNode) {
          neighborNode = new CityNode(neighbor);
        }

        // Skip if the neighbor is in the closed set
        if (Array.from(closedSet).some((node) => node.city.id === neighborNode!.city.id)) {
          continue;
        }

        // Calculate estimate for neighbor, just trying to find shortest path in node hops, so always current path + 1
        const estimate = current.costSoFar + 1;

        // If this path to neighbor is better than any previous one, record it
        if (estimate < neighborNode.costSoFar) {
          neighborNode.parent = current;
          neighborNode.costSoFar = estimate;

          nodeMap.set(neighbor.id, neighborNode);
          openSet.add(neighborNode);
        }
      }
    }

    // If we get here, no path was found
    return null;
  }

  articulationCities(forceRoot?: City): City[] {
    // Determine articulation points in the graph using DFS
    const rootNode = forceRoot || this.cities.find((city) => !city.isClosed);

    if (!rootNode) {
      return [];
    }

    const articulationPoints: City[] = [];

    const discoveredTime = new Map<string, number>();
    const isExplored = new Map<string, boolean>();
    const low = new Map<string, number>();
    const parent = new Map<string, City>();

    let time = 0;

    const dfs = (v: City) => {
      isExplored.set(v.id, true);
      time += 1;
      discoveredTime.set(v.id, time);
      low.set(v.id, time);

      let childCount = 0;

      for (const x of this.openNeighbors(v)) {
        if (!isExplored.has(x.id)) {
          childCount += 1;

          // Explore this subtree
          parent.set(x.id, v);
          dfs(x);
          low.set(v.id, Math.min(low.get(v.id)!, low.get(x.id)!));

          // u is an articulation point if:
          // 1. It's the root and has more than 1 child.
          // 2. It's not the root and no vertex in the subtree rooted at one of its
          //    children has a back-link to its ancestor.

          const isRoot = !parent.has(v.id);

          if (isRoot && childCount > 1) {
            articulationPoints.push(v);
          } else if (!isRoot && low.get(x.id)! >= discoveredTime.get(v.id)!) {
            // v is an articulation point separating x
            articulationPoints.push(v);
          }
        } else if (!parent.has(v.id) || !x.equals(parent.get(v.id)!)) {
          low.set(v.id, Math.min(low.get(v.id)!, discoveredTime.get(x.id)!));
        }
      }
    };

    dfs(rootNode);

    return articulationPoints;
  }

  // Helper function to reconstruct the path by following parent pointers
  private reconstructPath(node: CityNode): City[] {
    const path: City[] = [];
    let current: CityNode | undefined = node;

    while (current) {
      path.push(current.city);
      current = current.parent;
    }

    return path.reverse(); // Return path from start to end
  }
}
