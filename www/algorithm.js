// Priority Queue implementation for A*
class PriorityQueue {
  constructor() {
    this.values = [];
  }

  enqueue(val, priority) {
    this.values.push({ val, priority });
    this.sort();
  }

  dequeue() {
    return this.values.shift();
  }

  sort() {
    this.values.sort((a, b) => a.priority - b.priority);
  }

  isEmpty() {
    return this.values.length === 0;
  }
}

// Custom A* pathfinding implementation
class PathFinder {
  constructor(graphData) {
    this.graphData = graphData;
    this.graph = this.buildGraph();
  }

  // Build adjacency list representation of the graph
  buildGraph() {
    const graph = new Map();
    
    this.graphData.forEach(edge => {
      const point1 = `${edge.x1},${edge.y1}`;
      const point2 = `${edge.x2},${edge.y2}`;
      
      if (!graph.has(point1)) {
        graph.set(point1, new Map());
      }
      if (!graph.has(point2)) {
        graph.set(point2, new Map());
      }
      
      // Calculate distance between points
      const distance = Math.sqrt(
        Math.pow(edge.x2 - edge.x1, 2) + 
        Math.pow(edge.y2 - edge.y1, 2)
      );
      
      graph.get(point1).set(point2, distance);
      graph.get(point2).set(point1, distance);
    });
    
    return graph;
  }

  // Find closest point in the graph to given coordinates
  findClosestPoint(x, y, maxDistance = 100) {
    let closestPoint = null;
    let minDistance = Infinity;
    
    for (const edge of this.graphData) {
      // Check distance to first point
      const dist1 = Math.sqrt(
        Math.pow(edge.x1 - x, 2) + 
        Math.pow(edge.y1 - y, 2)
      );
      if (dist1 < minDistance) {
        minDistance = dist1;
        closestPoint = `${edge.x1},${edge.y1}`;
      }
      
      // Check distance to second point
      const dist2 = Math.sqrt(
        Math.pow(edge.x2 - x, 2) + 
        Math.pow(edge.y2 - y, 2)
      );
      if (dist2 < minDistance) {
        minDistance = dist2;
        closestPoint = `${edge.x2},${edge.y2}`;
      }
    }
    
    return minDistance < maxDistance ? closestPoint : null;
  }

  // A* pathfinding algorithm
  findPath(startX, startY, endX, endY) {
    // Find closest graph points to start and end
    console.log("here");
    const startPoint = this.findClosestPoint(startX, startY);

    console.log("here");
    const endPoint = this.findClosestPoint(endX, endY);
    
    if (!startPoint || !endPoint) {
      return null;
    }

    // Initialize data structures
    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map(); // Cost from start to current
    const fScore = new Map(); // Estimated total cost

    // Initialize scores
    for (const point of this.graph.keys()) {
      gScore.set(point, Infinity);
      fScore.set(point, Infinity);
    }

    // Add start point to open set
    gScore.set(startPoint, 0);
    fScore.set(startPoint, this.heuristic(startPoint, endPoint));
    openSet.enqueue(startPoint, fScore.get(startPoint));

    while (!openSet.isEmpty()) {
      const current = openSet.dequeue().val;

      // If we reached the end, reconstruct and return path
      if (current === endPoint) {
        return this.reconstructPath(cameFrom, current, startX, startY, endX, endY);
      }

      // Move current from open to closed set
      closedSet.add(current);

      // Check all neighbors
      const neighbors = this.graph.get(current);
      for (const [neighbor, distance] of neighbors) {
        if (closedSet.has(neighbor)) continue;

        // Calculate tentative gScore
        const tentativeGScore = gScore.get(current) + distance;

        // If this path to neighbor is better than previous one
        if (tentativeGScore < gScore.get(neighbor)) {
          // Update path and scores
          cameFrom.set(neighbor, current);
          gScore.set(neighbor, tentativeGScore);
          fScore.set(neighbor, tentativeGScore + this.heuristic(neighbor, endPoint));

          // Add to open set if not already there
          if (!openSet.values.some(item => item.val === neighbor)) {
            openSet.enqueue(neighbor, fScore.get(neighbor));
          }
        }
      }
    }

    // No path found
    return null;
  }

  // Calculate heuristic (Euclidean distance)
  heuristic(point1, point2) {
    const [x1, y1] = point1.split(',').map(Number);
    const [x2, y2] = point2.split(',').map(Number);
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  // Reconstruct path from start to end
  reconstructPath(cameFrom, current, startX, startY, endX, endY) {
    const path = [];
    
    // Add end point
    path.push({ x: endX, y: endY });
    
    // Reconstruct path through graph
    while (current) {
      const [x, y] = current.split(',').map(Number);
      path.unshift({ x, y });
      current = cameFrom.get(current);
    }
    
    // Add start point
    path.unshift({ x: startX, y: startY });
    
    return path;
  }
}

// Export the PathFinder class
export default PathFinder; 