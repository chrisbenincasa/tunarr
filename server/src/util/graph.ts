export class Graph {}

export class GraphNode {
  #edges: GraphEdge[] = [];

  constructor(public key: string) {}

  addEdge(edge: GraphEdge): ThisType<GraphNode> {
    this.#edges.push(edge);
    return this;
  }

  getEdges() {
    return this.#edges;
  }
}

export class GraphEdge {
  constructor(
    public start: GraphNode,
    public end: GraphNode,
    public weight: number = 0,
  ) {}
}
