/**
 * V3 Swarm Types
 * Modernized type system for swarm coordination
 */
/**
 * Topology configuration presets
 */
export const TopologyPresets = {
    hierarchical: {
        topology: 'hierarchical',
        coordination: {
            consensusRequired: false,
            timeoutMs: 5000,
            retryPolicy: { maxRetries: 3, backoffMs: 1000 }
        }
    },
    mesh: {
        topology: 'mesh',
        coordination: {
            consensusRequired: true,
            timeoutMs: 10000,
            retryPolicy: { maxRetries: 5, backoffMs: 500 }
        }
    },
    ring: {
        topology: 'ring',
        coordination: {
            consensusRequired: true,
            timeoutMs: 8000,
            retryPolicy: { maxRetries: 4, backoffMs: 750 }
        }
    },
    star: {
        topology: 'star',
        coordination: {
            consensusRequired: false,
            timeoutMs: 3000,
            retryPolicy: { maxRetries: 2, backoffMs: 500 }
        }
    },
    adaptive: {
        topology: 'adaptive',
        autoScale: {
            enabled: true,
            minAgents: 1,
            maxAgents: 20,
            scaleUpThreshold: 0.8,
            scaleDownThreshold: 0.3
        },
        coordination: {
            consensusRequired: true,
            timeoutMs: 10000,
            retryPolicy: { maxRetries: 5, backoffMs: 500 }
        }
    },
    'hierarchical-mesh': {
        topology: 'hierarchical-mesh',
        coordination: {
            consensusRequired: true,
            timeoutMs: 8000,
            retryPolicy: { maxRetries: 4, backoffMs: 750 }
        }
    }
};
//# sourceMappingURL=swarm.types.js.map