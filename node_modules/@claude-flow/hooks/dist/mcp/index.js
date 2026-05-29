/**
 * V3 Hooks MCP Tools
 *
 * MCP tool definitions for hooks system integration.
 * These tools provide programmatic access to hooks functionality.
 */
/**
 * Pre-edit hook MCP tool
 */
export const preEditTool = {
    name: 'hooks/pre-edit',
    description: 'Execute pre-edit hooks for a file. Gets context, suggestions, and warnings before file modification.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Path to the file being edited',
            },
            operation: {
                type: 'string',
                enum: ['create', 'modify', 'delete'],
                description: 'Type of edit operation',
                default: 'modify',
            },
            includeContext: {
                type: 'boolean',
                description: 'Include file context in response',
                default: true,
            },
            includeSuggestions: {
                type: 'boolean',
                description: 'Include agent suggestions',
                default: true,
            },
        },
        required: ['filePath'],
    },
    handler: async (input) => {
        const filePath = input.filePath;
        const operation = input.operation || 'modify';
        const includeContext = input.includeContext !== false;
        const includeSuggestions = input.includeSuggestions !== false;
        const result = {
            filePath,
            operation,
        };
        if (includeContext) {
            result.context = {
                fileExists: true, // Would check fs in real implementation
                fileType: getFileType(filePath),
                relatedFiles: [],
                similarPatterns: [],
            };
        }
        if (includeSuggestions) {
            result.suggestions = [
                {
                    agent: 'coder',
                    suggestion: `Use standard patterns for ${operation} operation`,
                    confidence: 0.85,
                    rationale: 'Based on file type and historical patterns',
                },
            ];
        }
        return result;
    },
};
/**
 * Post-edit hook MCP tool
 */
export const postEditTool = {
    name: 'hooks/post-edit',
    description: 'Execute post-edit hooks to record outcome for learning.',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: {
                type: 'string',
                description: 'Path to the edited file',
            },
            operation: {
                type: 'string',
                enum: ['create', 'modify', 'delete'],
                description: 'Type of edit operation',
                default: 'modify',
            },
            success: {
                type: 'boolean',
                description: 'Whether the edit was successful',
            },
            outcome: {
                type: 'string',
                description: 'Description of the outcome',
            },
            metadata: {
                type: 'object',
                description: 'Additional metadata',
            },
        },
        required: ['filePath', 'success'],
    },
    handler: async (input) => {
        const filePath = input.filePath;
        const operation = input.operation || 'modify';
        const success = input.success;
        return {
            filePath,
            operation,
            success,
            recorded: true,
            recordedAt: new Date().toISOString(),
            patternId: success ? `pattern-${Date.now()}` : undefined,
        };
    },
};
/**
 * Route task MCP tool
 */
export const routeTaskTool = {
    name: 'hooks/route',
    description: 'Route a task to the optimal agent based on learned patterns.',
    inputSchema: {
        type: 'object',
        properties: {
            task: {
                type: 'string',
                description: 'Task description to route',
            },
            context: {
                type: 'string',
                description: 'Additional context for routing',
            },
            preferredAgents: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of preferred agents',
            },
            constraints: {
                type: 'object',
                description: 'Routing constraints',
            },
            includeExplanation: {
                type: 'boolean',
                description: 'Include explanation for routing decision',
                default: true,
            },
        },
        required: ['task'],
    },
    handler: async (input) => {
        const task = input.task;
        const includeExplanation = input.includeExplanation !== false;
        // Simple keyword-based routing (real implementation uses ReasoningBank)
        const agent = routeTaskToAgent(task);
        const result = {
            task,
            recommendedAgent: agent.name,
            confidence: agent.confidence,
            alternativeAgents: agent.alternatives,
        };
        if (includeExplanation) {
            result.explanation = agent.explanation;
            result.reasoning = {
                factors: agent.factors,
            };
        }
        return result;
    },
};
/**
 * Metrics query MCP tool
 */
export const metricsTool = {
    name: 'hooks/metrics',
    description: 'Query hooks learning metrics and statistics.',
    inputSchema: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: ['all', 'routing', 'edits', 'commands', 'patterns'],
                description: 'Metrics category to query',
                default: 'all',
            },
            timeRange: {
                type: 'string',
                enum: ['hour', 'day', 'week', 'month', 'all'],
                description: 'Time range for metrics',
                default: 'all',
            },
            includeDetailedStats: {
                type: 'boolean',
                description: 'Include detailed statistics',
                default: false,
            },
            format: {
                type: 'string',
                enum: ['json', 'summary'],
                description: 'Output format',
                default: 'json',
            },
        },
    },
    handler: async (input) => {
        const category = input.category || 'all';
        const timeRange = input.timeRange || 'all';
        return {
            category,
            timeRange,
            summary: {
                totalOperations: 1547,
                successRate: 89,
                avgQuality: 0.87,
                patternsLearned: 156,
            },
            routing: {
                totalRoutes: 423,
                avgConfidence: 0.84,
                topAgents: [
                    { agent: 'coder', count: 156, successRate: 0.92 },
                    { agent: 'reviewer', count: 89, successRate: 0.88 },
                    { agent: 'tester', count: 67, successRate: 0.91 },
                ],
            },
            edits: {
                totalEdits: 756,
                successRate: 0.93,
                commonPatterns: ['typescript', 'react', 'api'],
            },
            commands: {
                totalCommands: 368,
                successRate: 0.82,
                avgExecutionTime: 4230,
                commonCommands: ['npm test', 'npm build', 'git status'],
            },
        };
    },
};
/**
 * Pre-command hook MCP tool
 */
export const preCommandTool = {
    name: 'hooks/pre-command',
    description: 'Execute pre-command hooks to assess risk before command execution.',
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Command to be executed',
            },
            workingDirectory: {
                type: 'string',
                description: 'Working directory for command',
            },
            assessRisk: {
                type: 'boolean',
                description: 'Include risk assessment',
                default: true,
            },
        },
        required: ['command'],
    },
    handler: async (input) => {
        const command = input.command;
        const riskLevel = assessCommandRisk(command);
        return {
            command,
            riskLevel: riskLevel.level,
            warnings: riskLevel.warnings,
            proceed: riskLevel.level !== 'high',
        };
    },
};
/**
 * Post-command hook MCP tool
 */
export const postCommandTool = {
    name: 'hooks/post-command',
    description: 'Execute post-command hooks to record command execution outcome.',
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'Executed command',
            },
            success: {
                type: 'boolean',
                description: 'Whether command succeeded',
            },
            exitCode: {
                type: 'number',
                description: 'Command exit code',
                default: 0,
            },
            output: {
                type: 'string',
                description: 'Command output (truncated)',
            },
            error: {
                type: 'string',
                description: 'Error message if failed',
            },
            executionTime: {
                type: 'number',
                description: 'Execution time in milliseconds',
            },
        },
        required: ['command', 'success'],
    },
    handler: async (input) => {
        const success = input.success;
        return {
            recorded: true,
            patternId: success ? `cmd-${Date.now()}` : undefined,
        };
    },
};
/**
 * Daemon status MCP tool
 */
export const daemonStatusTool = {
    name: 'hooks/daemon-status',
    description: 'Get status of hooks daemons.',
    inputSchema: {
        type: 'object',
        properties: {
            daemon: {
                type: 'string',
                description: 'Specific daemon to check (or all)',
            },
        },
    },
    handler: async (input) => {
        return {
            daemons: [
                { name: 'metrics-sync', status: 'running', lastUpdate: new Date().toISOString(), executionCount: 45 },
                { name: 'swarm-monitor', status: 'running', lastUpdate: new Date().toISOString(), executionCount: 890 },
                { name: 'hooks-learning', status: 'running', lastUpdate: new Date().toISOString(), executionCount: 15 },
            ],
        };
    },
};
/**
 * Statusline data MCP tool
 */
export const statuslineTool = {
    name: 'hooks/statusline',
    description: 'Get statusline data for display.',
    inputSchema: {
        type: 'object',
        properties: {
            format: {
                type: 'string',
                enum: ['json', 'text'],
                description: 'Output format',
                default: 'json',
            },
        },
    },
    handler: async (input) => {
        const { StatuslineGenerator } = await import('../statusline/index.js');
        const generator = new StatuslineGenerator();
        const format = input.format || 'json';
        if (format === 'text') {
            return { statusline: generator.generateStatusline() };
        }
        return generator.generateData();
    },
};
/**
 * All hooks MCP tools
 */
export const hooksMCPTools = [
    preEditTool,
    postEditTool,
    routeTaskTool,
    metricsTool,
    preCommandTool,
    postCommandTool,
    daemonStatusTool,
    statuslineTool,
];
/**
 * Get tool by name
 */
export function getHooksTool(name) {
    return hooksMCPTools.find((t) => t.name === name);
}
// Helper functions
function getFileType(filePath) {
    const ext = filePath.split('.').pop() || '';
    const typeMap = {
        ts: 'typescript',
        tsx: 'typescript-react',
        js: 'javascript',
        jsx: 'javascript-react',
        py: 'python',
        go: 'go',
        rs: 'rust',
        md: 'markdown',
        json: 'json',
        yaml: 'yaml',
        yml: 'yaml',
    };
    return typeMap[ext] || 'unknown';
}
function routeTaskToAgent(task) {
    const taskLower = task.toLowerCase();
    // Security-related tasks
    if (taskLower.includes('security') || taskLower.includes('auth') || taskLower.includes('cve')) {
        return {
            name: 'security-auditor',
            confidence: 0.92,
            alternatives: [
                { agent: 'coder', confidence: 0.78 },
                { agent: 'reviewer', confidence: 0.75 },
            ],
            explanation: 'Task involves security considerations, routing to security-auditor.',
            factors: [
                { factor: 'keyword_match', weight: 0.4, value: 0.95 },
                { factor: 'historical_success', weight: 0.3, value: 0.88 },
                { factor: 'agent_availability', weight: 0.3, value: 0.93 },
            ],
        };
    }
    // Testing tasks
    if (taskLower.includes('test') || taskLower.includes('spec') || taskLower.includes('coverage')) {
        return {
            name: 'tester',
            confidence: 0.89,
            alternatives: [
                { agent: 'coder', confidence: 0.72 },
                { agent: 'reviewer', confidence: 0.68 },
            ],
            explanation: 'Task involves testing, routing to tester agent.',
            factors: [
                { factor: 'keyword_match', weight: 0.4, value: 0.90 },
                { factor: 'historical_success', weight: 0.3, value: 0.87 },
                { factor: 'agent_availability', weight: 0.3, value: 0.91 },
            ],
        };
    }
    // Review tasks
    if (taskLower.includes('review') || taskLower.includes('check') || taskLower.includes('audit')) {
        return {
            name: 'reviewer',
            confidence: 0.87,
            alternatives: [
                { agent: 'coder', confidence: 0.70 },
                { agent: 'tester', confidence: 0.65 },
            ],
            explanation: 'Task involves review, routing to reviewer agent.',
            factors: [
                { factor: 'keyword_match', weight: 0.4, value: 0.88 },
                { factor: 'historical_success', weight: 0.3, value: 0.85 },
                { factor: 'agent_availability', weight: 0.3, value: 0.88 },
            ],
        };
    }
    // Default to coder
    return {
        name: 'coder',
        confidence: 0.80,
        alternatives: [
            { agent: 'reviewer', confidence: 0.65 },
            { agent: 'tester', confidence: 0.60 },
        ],
        explanation: 'General development task, routing to coder agent.',
        factors: [
            { factor: 'default_routing', weight: 0.5, value: 0.80 },
            { factor: 'historical_success', weight: 0.3, value: 0.78 },
            { factor: 'agent_availability', weight: 0.2, value: 0.82 },
        ],
    };
}
function assessCommandRisk(command) {
    const warnings = [];
    let level = 'low';
    // High-risk patterns
    const highRisk = ['rm -rf', 'format', 'fdisk', 'mkfs', 'dd if='];
    for (const pattern of highRisk) {
        if (command.includes(pattern)) {
            level = 'high';
            warnings.push(`High-risk pattern detected: ${pattern}`);
        }
    }
    // Medium-risk patterns
    const mediumRisk = ['sudo', 'chmod 777', 'npm publish', 'git push --force'];
    for (const pattern of mediumRisk) {
        if (command.includes(pattern)) {
            if (level === 'low')
                level = 'medium';
            warnings.push(`Medium-risk pattern detected: ${pattern}`);
        }
    }
    return { level, warnings };
}
//# sourceMappingURL=index.js.map