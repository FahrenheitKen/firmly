/**
 * @ruvector/graph-node native graph database backend (ADR-087)
 *
 * Provides persistent graph storage for agent relationships, causal edges,
 * task dependencies, and swarm topology using native Rust bindings.
 *
 * API requirements discovered via testing:
 * - createNode: requires { id, type, embedding }
 * - createEdge: requires { from, to, label, description, embedding, properties }
 * - createHyperedge: requires { nodes[], label, description, embedding, properties }
 * - kHopNeighbors(nodeId, k): returns string[] of node IDs
 * - stats(): returns { totalNodes, totalEdges, avgDegree }
 */
export interface GraphNodeData {
    id: string;
    type: string;
    name?: string;
    properties?: Record<string, unknown>;
}
export interface GraphEdgeData {
    from: string;
    to: string;
    label: string;
    description?: string;
    weight?: number;
    properties?: Record<string, unknown>;
}
export interface GraphStats {
    totalNodes: number;
    totalEdges: number;
    avgDegree: number;
    backend: 'graph-node' | 'unavailable';
}
/**
 * Check if graph-node backend is available
 */
export declare function isGraphBackendAvailable(): Promise<boolean>;
/**
 * Add a node to the graph (agent, task, pattern, etc.)
 */
export declare function addNode(data: GraphNodeData): Promise<string | null>;
/**
 * Add an edge between two nodes
 */
export declare function addEdge(data: GraphEdgeData): Promise<string | null>;
/**
 * Create a hyperedge connecting multiple nodes (e.g., swarm teams)
 */
export declare function addHyperedge(nodeIds: string[], label: string, description?: string, properties?: Record<string, unknown>): Promise<string | null>;
/**
 * Get k-hop neighbors of a node
 */
export declare function getNeighbors(nodeId: string, hops?: number): Promise<string[]>;
/**
 * Get graph statistics
 */
export declare function getGraphStats(): Promise<GraphStats>;
/**
 * Record a causal edge (used by agentdb_causal-edge MCP tool)
 */
export declare function recordCausalEdge(sourceId: string, targetId: string, relation: string, weight?: number): Promise<{
    success: boolean;
    edgeId?: string;
    backend: string;
}>;
/**
 * Record agent collaboration (used by swarm coordination)
 */
export declare function recordCollaboration(agentId: string, agentType: string, taskId: string, taskName: string): Promise<{
    success: boolean;
}>;
/**
 * Record swarm team as a hyperedge
 */
export declare function recordSwarmTeam(agentIds: string[], topology: string, taskDescription?: string): Promise<{
    success: boolean;
    hyperedgeId?: string;
}>;
//# sourceMappingURL=graph-backend.d.ts.map