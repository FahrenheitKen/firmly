/**
 * V3 ReasoningBank - Pattern Learning with AgentDB
 *
 * Connects hooks to persistent vector storage using AgentDB adapter.
 * No JSON - all patterns stored as vectors in memory.db
 *
 * Features:
 * - Real HNSW indexing (M=16, efConstruction=200) for 150x+ faster search
 * - ONNX embeddings via @claude-flow/embeddings (MiniLM-L6 384-dim)
 * - AgentDB backend for persistence
 * - Pattern promotion from short-term to long-term memory
 *
 * @module @claude-flow/hooks/reasoningbank
 */
import { EventEmitter } from 'node:events';
// Dynamic imports for optional dependencies
let AgentDBAdapter = null;
let HNSWIndex = null;
let EmbeddingServiceImpl = null;
const DEFAULT_CONFIG = {
    dimensions: 384, // MiniLM-L6
    hnswM: 16,
    hnswEfConstruction: 200,
    hnswEfSearch: 100,
    maxShortTerm: 1000,
    maxLongTerm: 5000,
    promotionThreshold: 3,
    qualityThreshold: 0.6,
    dedupThreshold: 0.95,
    dbPath: '.claude-flow/memory.db',
    useMockEmbeddings: false,
};
/**
 * Agent mapping for routing
 */
const AGENT_PATTERNS = {
    'security-architect': /security|auth|cve|vuln|encrypt|password|token/i,
    'test-architect': /test|spec|mock|coverage|tdd|assert/i,
    'performance-engineer': /perf|optim|fast|memory|cache|speed|slow/i,
    'core-architect': /architect|design|ddd|domain|refactor|struct/i,
    'swarm-specialist': /swarm|agent|coordinate|orchestrat|parallel/i,
    'memory-specialist': /memory|agentdb|hnsw|vector|embedding/i,
    'coder': /fix|bug|implement|create|add|build|error|code/i,
    'reviewer': /review|quality|lint|check|audit/i,
};
/**
 * Domain-specific guidance templates
 */
const DOMAIN_GUIDANCE = {
    security: [
        'Validate all inputs at system boundaries',
        'Use parameterized queries (no string concatenation)',
        'Store secrets in environment variables only',
        'Apply principle of least privilege',
        'Check OWASP Top 10 patterns',
    ],
    testing: [
        'Write test first, then implementation (TDD)',
        'Mock external dependencies',
        'Test behavior, not implementation',
        'One assertion per test concept',
        'Use descriptive test names',
    ],
    performance: [
        'Use HNSW for vector search (not brute-force)',
        'Batch database operations',
        'Implement caching at appropriate layers',
        'Profile before optimizing',
        'Target: <1ms searches, <100ms operations',
    ],
    architecture: [
        'Respect bounded context boundaries',
        'Use domain events for cross-module communication',
        'Keep domain logic in domain layer',
        'Infrastructure adapters for external services',
        'Follow ADR decisions (ADR-001 through ADR-010)',
    ],
    debugging: [
        'Reproduce the issue first',
        'Check recent changes in git log',
        'Add logging before fixing',
        'Write regression test',
        "Verify fix doesn't break other tests",
    ],
};
/**
 * ReasoningBank - Vector-based pattern storage and retrieval
 *
 * Uses AgentDB adapter for HNSW-indexed pattern storage.
 * Provides guidance generation from learned patterns.
 */
export class ReasoningBank extends EventEmitter {
    config;
    agentDB = null;
    hnswIndex = null;
    embeddingService;
    initialized = false;
    useRealBackend = false;
    // In-memory caches for fast access
    shortTermPatterns = new Map();
    longTermPatterns = new Map();
    // Metrics
    metrics = {
        patternsStored: 0,
        patternsRetrieved: 0,
        searchCount: 0,
        totalSearchTime: 0,
        promotions: 0,
        hnswSearchTime: 0,
        bruteForceSearchTime: 0,
    };
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.embeddingService = new FallbackEmbeddingService(this.config.dimensions);
    }
    /**
     * Initialize ReasoningBank with AgentDB backend and real HNSW
     */
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Try to load real implementations
            await this.loadDependencies();
            if (AgentDBAdapter && HNSWIndex) {
                // Initialize real HNSW index
                this.hnswIndex = new HNSWIndex({
                    dimensions: this.config.dimensions,
                    M: this.config.hnswM,
                    efConstruction: this.config.hnswEfConstruction,
                    maxElements: this.config.maxShortTerm + this.config.maxLongTerm,
                    metric: 'cosine',
                });
                // Initialize AgentDB adapter
                this.agentDB = new AgentDBAdapter({
                    dimensions: this.config.dimensions,
                    hnswM: this.config.hnswM,
                    hnswEfConstruction: this.config.hnswEfConstruction,
                    maxEntries: this.config.maxShortTerm + this.config.maxLongTerm,
                    persistenceEnabled: true,
                    persistencePath: this.config.dbPath,
                    embeddingGenerator: (text) => this.embeddingService.embed(text),
                });
                await this.agentDB.initialize();
                this.useRealBackend = true;
                // Try to use real embedding service
                if (EmbeddingServiceImpl && !this.config.useMockEmbeddings) {
                    try {
                        this.embeddingService = new RealEmbeddingService(this.config.dimensions);
                        await this.embeddingService.initialize();
                    }
                    catch (e) {
                        console.warn('[ReasoningBank] Real embeddings unavailable, using hash-based fallback');
                    }
                }
                await this.loadPatterns();
                console.log(`[ReasoningBank] Initialized with AgentDB + HNSW (M=${this.config.hnswM}, efConstruction=${this.config.hnswEfConstruction})`);
            }
            else {
                throw new Error('Dependencies not available');
            }
            this.initialized = true;
            this.emit('initialized', {
                shortTermCount: this.shortTermPatterns.size,
                longTermCount: this.longTermPatterns.size,
                useRealBackend: this.useRealBackend,
            });
        }
        catch (error) {
            // Fallback to in-memory only mode
            console.warn('[ReasoningBank] AgentDB not available, using in-memory mode');
            this.useRealBackend = false;
            this.initialized = true;
        }
    }
    /**
     * Load optional dependencies
     */
    async loadDependencies() {
        // Try to load optional peer dependencies at runtime
        const dynamicImport = async (moduleName) => {
            try {
                return await import(/* webpackIgnore: true */ moduleName);
            }
            catch {
                return null;
            }
        };
        const memoryModule = await dynamicImport('@claude-flow/memory');
        if (memoryModule) {
            AgentDBAdapter = memoryModule.AgentDBAdapter;
            HNSWIndex = memoryModule.HNSWIndex;
        }
        const embeddingsModule = await dynamicImport('@claude-flow/embeddings');
        if (embeddingsModule) {
            EmbeddingServiceImpl = embeddingsModule.createEmbeddingService;
        }
    }
    /**
     * Store a new pattern from hook execution
     */
    async storePattern(strategy, domain, metadata = {}) {
        await this.ensureInitialized();
        const embedding = await this.embeddingService.embed(strategy);
        // Check for duplicates using vector similarity
        const similar = await this.searchPatterns(embedding, 1);
        if (similar.length > 0 && similar[0].similarity > this.config.dedupThreshold) {
            // Update existing pattern
            const existing = similar[0].pattern;
            existing.usageCount++;
            existing.updatedAt = Date.now();
            existing.quality = this.calculateQuality(existing);
            await this.updateInStorage(existing);
            this.checkPromotion(existing);
            return { id: existing.id, action: 'updated' };
        }
        // Create new pattern
        const pattern = {
            id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            strategy,
            domain,
            embedding,
            quality: 0.5,
            usageCount: 1,
            successCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata,
        };
        this.shortTermPatterns.set(pattern.id, pattern);
        // Add to HNSW index if available
        if (this.hnswIndex) {
            await this.hnswIndex.addPoint(pattern.id, embedding);
        }
        await this.storeInAgentDB(pattern, 'short_term');
        this.metrics.patternsStored++;
        this.emit('pattern:stored', { id: pattern.id, domain });
        return { id: pattern.id, action: 'created' };
    }
    /**
     * Search for similar patterns using HNSW (if available) or brute-force
     */
    async searchPatterns(query, k = 5) {
        await this.ensureInitialized();
        const startTime = performance.now();
        const embedding = typeof query === 'string'
            ? await this.embeddingService.embed(query)
            : query;
        let results = [];
        // Try HNSW search first (150x+ faster)
        if (this.hnswIndex && this.useRealBackend) {
            const hnswStart = performance.now();
            try {
                const hnswResults = await this.hnswIndex.search(embedding, k, this.config.hnswEfSearch);
                this.metrics.hnswSearchTime += performance.now() - hnswStart;
                for (const { id, distance } of hnswResults) {
                    const pattern = this.shortTermPatterns.get(id) || this.longTermPatterns.get(id);
                    if (pattern) {
                        // Convert distance to similarity (cosine distance -> similarity)
                        const similarity = 1 - distance;
                        results.push({ pattern, similarity });
                    }
                }
            }
            catch (e) {
                console.warn('[ReasoningBank] HNSW search failed, falling back to brute-force');
                results = this.bruteForceSearch(embedding, k);
            }
        }
        else {
            // Brute-force search
            results = this.bruteForceSearch(embedding, k);
        }
        const searchTime = performance.now() - startTime;
        this.metrics.searchCount++;
        this.metrics.totalSearchTime += searchTime;
        this.metrics.patternsRetrieved += results.length;
        return results;
    }
    /**
     * Brute-force search (fallback)
     */
    bruteForceSearch(embedding, k) {
        const startTime = performance.now();
        const results = [];
        // Search long-term first (higher quality)
        for (const pattern of this.longTermPatterns.values()) {
            const similarity = this.cosineSimilarity(embedding, pattern.embedding);
            results.push({ pattern, similarity });
        }
        // Search short-term
        for (const pattern of this.shortTermPatterns.values()) {
            const similarity = this.cosineSimilarity(embedding, pattern.embedding);
            results.push({ pattern, similarity });
        }
        // Sort by similarity and take top k
        results.sort((a, b) => b.similarity - a.similarity);
        this.metrics.bruteForceSearchTime += performance.now() - startTime;
        return results.slice(0, k);
    }
    /**
     * Generate guidance for a given context
     */
    async generateGuidance(context) {
        await this.ensureInitialized();
        const startTime = performance.now();
        const query = this.buildQueryFromContext(context);
        const patterns = await this.searchPatterns(query, 5);
        // Detect domains from context
        const domains = this.detectDomains(query);
        // Build recommendations from domain templates
        const recommendations = [];
        for (const domain of domains) {
            if (DOMAIN_GUIDANCE[domain]) {
                recommendations.push(...DOMAIN_GUIDANCE[domain]);
            }
        }
        // Generate context string
        const contextParts = [];
        if (domains.length > 0) {
            contextParts.push(`**Detected Domains**: ${domains.join(', ')}`);
        }
        if (patterns.length > 0) {
            contextParts.push('**Relevant Patterns**:');
            for (const { pattern, similarity } of patterns.slice(0, 3)) {
                contextParts.push(`- ${pattern.strategy} (${(similarity * 100).toFixed(0)}% match)`);
            }
        }
        // Agent suggestion
        const agentSuggestion = this.suggestAgent(query);
        return {
            patterns,
            context: contextParts.join('\n'),
            recommendations: recommendations.slice(0, 5),
            agentSuggestion,
            searchTimeMs: performance.now() - startTime,
        };
    }
    /**
     * Route task to optimal agent based on learned patterns
     */
    async routeTask(task) {
        await this.ensureInitialized();
        const suggestion = this.suggestAgent(task);
        // Get historical performance from patterns
        const taskPatterns = await this.searchPatterns(task, 10);
        const agentPerformance = new Map();
        for (const { pattern } of taskPatterns) {
            const agent = pattern.metadata.agent || 'coder';
            const perf = agentPerformance.get(agent) || { success: 0, total: 0, quality: 0 };
            perf.total++;
            perf.success += pattern.successCount / Math.max(pattern.usageCount, 1);
            perf.quality += pattern.quality;
            agentPerformance.set(agent, perf);
        }
        // Calculate historical performance for suggested agent
        const historicalPerf = agentPerformance.get(suggestion.agent);
        const historicalPerformance = historicalPerf
            ? {
                successRate: historicalPerf.success / historicalPerf.total,
                avgQuality: historicalPerf.quality / historicalPerf.total,
                taskCount: historicalPerf.total,
            }
            : undefined;
        // Build alternatives
        const alternatives = Object.entries(AGENT_PATTERNS)
            .filter(([agent]) => agent !== suggestion.agent)
            .map(([agent, pattern]) => ({
            agent,
            confidence: pattern.test(task) ? 85 : 60,
        }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
        return {
            agent: suggestion.agent,
            confidence: suggestion.confidence,
            alternatives,
            reasoning: suggestion.reasoning,
            historicalPerformance,
        };
    }
    /**
     * Record pattern usage outcome
     */
    async recordOutcome(patternId, success) {
        const pattern = this.shortTermPatterns.get(patternId) ||
            this.longTermPatterns.get(patternId);
        if (!pattern)
            return;
        pattern.usageCount++;
        if (success)
            pattern.successCount++;
        pattern.quality = this.calculateQuality(pattern);
        pattern.updatedAt = Date.now();
        await this.updateInStorage(pattern);
        this.checkPromotion(pattern);
        this.emit('outcome:recorded', { patternId, success });
    }
    /**
     * Consolidate patterns (dedup, prune, promote)
     * Called by HooksLearningDaemon
     */
    async consolidate() {
        await this.ensureInitialized();
        let duplicatesRemoved = 0;
        let patternsPruned = 0;
        let patternsPromoted = 0;
        // Check promotions
        for (const pattern of this.shortTermPatterns.values()) {
            if (this.shouldPromote(pattern)) {
                await this.promotePattern(pattern);
                patternsPromoted++;
            }
        }
        // Prune old low-quality short-term patterns
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        for (const [id, pattern] of this.shortTermPatterns) {
            if (now - pattern.createdAt > maxAge && pattern.usageCount < 2) {
                this.shortTermPatterns.delete(id);
                await this.deleteFromStorage(id);
                patternsPruned++;
            }
        }
        // Deduplicate similar patterns
        const patterns = Array.from(this.shortTermPatterns.values());
        for (let i = 0; i < patterns.length; i++) {
            for (let j = i + 1; j < patterns.length; j++) {
                const similarity = this.cosineSimilarity(patterns[i].embedding, patterns[j].embedding);
                if (similarity > this.config.dedupThreshold) {
                    // Keep the one with higher quality
                    const toRemove = patterns[i].quality >= patterns[j].quality ? patterns[j] : patterns[i];
                    this.shortTermPatterns.delete(toRemove.id);
                    await this.deleteFromStorage(toRemove.id);
                    duplicatesRemoved++;
                }
            }
        }
        this.emit('consolidated', { duplicatesRemoved, patternsPruned, patternsPromoted });
        return { duplicatesRemoved, patternsPruned, patternsPromoted };
    }
    /**
     * Get statistics
     */
    getStats() {
        const avgHnsw = this.metrics.searchCount > 0 ? this.metrics.hnswSearchTime / this.metrics.searchCount : 0;
        const avgBrute = this.metrics.searchCount > 0 ? this.metrics.bruteForceSearchTime / this.metrics.searchCount : 1;
        return {
            shortTermCount: this.shortTermPatterns.size,
            longTermCount: this.longTermPatterns.size,
            metrics: { ...this.metrics },
            avgSearchTime: this.metrics.searchCount > 0
                ? this.metrics.totalSearchTime / this.metrics.searchCount
                : 0,
            useRealBackend: this.useRealBackend,
            hnswSpeedup: avgBrute > 0 && avgHnsw > 0 ? avgBrute / avgHnsw : 1,
        };
    }
    /**
     * Export patterns for backup/transfer
     */
    async exportPatterns() {
        return {
            shortTerm: Array.from(this.shortTermPatterns.values()),
            longTerm: Array.from(this.longTermPatterns.values()),
        };
    }
    /**
     * Import patterns from backup
     */
    async importPatterns(data) {
        await this.ensureInitialized();
        let imported = 0;
        for (const pattern of data.shortTerm) {
            if (!this.shortTermPatterns.has(pattern.id)) {
                this.shortTermPatterns.set(pattern.id, pattern);
                if (this.hnswIndex) {
                    await this.hnswIndex.addPoint(pattern.id, pattern.embedding);
                }
                await this.storeInAgentDB(pattern, 'short_term');
                imported++;
            }
        }
        for (const pattern of data.longTerm) {
            if (!this.longTermPatterns.has(pattern.id)) {
                this.longTermPatterns.set(pattern.id, pattern);
                if (this.hnswIndex) {
                    await this.hnswIndex.addPoint(pattern.id, pattern.embedding);
                }
                await this.storeInAgentDB(pattern, 'long_term');
                imported++;
            }
        }
        return { imported };
    }
    // ===== Private Methods =====
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    async loadPatterns() {
        if (!this.agentDB)
            return;
        try {
            // Load from AgentDB namespaces
            const shortTermEntries = await this.agentDB.query({
                namespace: 'patterns:short_term',
                limit: this.config.maxShortTerm,
            });
            for (const entry of shortTermEntries) {
                const pattern = this.entryToPattern(entry);
                this.shortTermPatterns.set(pattern.id, pattern);
                if (this.hnswIndex) {
                    await this.hnswIndex.addPoint(pattern.id, pattern.embedding);
                }
            }
            const longTermEntries = await this.agentDB.query({
                namespace: 'patterns:long_term',
                limit: this.config.maxLongTerm,
            });
            for (const entry of longTermEntries) {
                const pattern = this.entryToPattern(entry);
                this.longTermPatterns.set(pattern.id, pattern);
                if (this.hnswIndex) {
                    await this.hnswIndex.addPoint(pattern.id, pattern.embedding);
                }
            }
        }
        catch (error) {
            console.warn('[ReasoningBank] Failed to load patterns:', error);
        }
    }
    async storeInAgentDB(pattern, type) {
        if (!this.agentDB)
            return;
        try {
            await this.agentDB.store({
                key: pattern.id,
                namespace: `patterns:${type}`,
                content: pattern.strategy,
                embedding: pattern.embedding,
                tags: [pattern.domain, type],
                metadata: {
                    quality: pattern.quality,
                    usageCount: pattern.usageCount,
                    successCount: pattern.successCount,
                    createdAt: pattern.createdAt,
                    updatedAt: pattern.updatedAt,
                    ...pattern.metadata,
                },
            });
        }
        catch (error) {
            console.warn('[ReasoningBank] Failed to store pattern:', error);
        }
    }
    async updateInStorage(pattern) {
        if (!this.agentDB)
            return;
        try {
            await this.agentDB.update(pattern.id, {
                metadata: {
                    quality: pattern.quality,
                    usageCount: pattern.usageCount,
                    successCount: pattern.successCount,
                    updatedAt: pattern.updatedAt,
                },
            });
        }
        catch (error) {
            console.warn('[ReasoningBank] Failed to update pattern:', error);
        }
    }
    async deleteFromStorage(id) {
        if (!this.agentDB)
            return;
        try {
            await this.agentDB.delete(id);
        }
        catch (error) {
            console.warn('[ReasoningBank] Failed to delete pattern:', error);
        }
    }
    entryToPattern(entry) {
        return {
            id: entry.id || entry.key,
            strategy: entry.content,
            domain: entry.tags?.[0] || 'general',
            embedding: entry.embedding instanceof Float32Array
                ? entry.embedding
                : new Float32Array(entry.embedding || []),
            quality: entry.metadata?.quality || 0.5,
            usageCount: entry.metadata?.usageCount || 1,
            successCount: entry.metadata?.successCount || 0,
            createdAt: entry.metadata?.createdAt || entry.createdAt || Date.now(),
            updatedAt: entry.metadata?.updatedAt || entry.updatedAt || Date.now(),
            metadata: entry.metadata || {},
        };
    }
    buildQueryFromContext(context) {
        const parts = [];
        if (context.file?.path) {
            parts.push(`file: ${context.file.path}`);
        }
        if (context.command?.raw) {
            parts.push(`command: ${context.command.raw}`);
        }
        if (context.task?.description) {
            parts.push(context.task.description);
        }
        if (context.routing?.task) {
            parts.push(context.routing.task);
        }
        return parts.join(' ');
    }
    detectDomains(text) {
        const domains = [];
        const lowerText = text.toLowerCase();
        if (/security|auth|password|token|secret|cve|vuln/i.test(lowerText)) {
            domains.push('security');
        }
        if (/test|spec|mock|coverage|tdd|assert/i.test(lowerText)) {
            domains.push('testing');
        }
        if (/perf|optim|fast|slow|memory|cache|speed/i.test(lowerText)) {
            domains.push('performance');
        }
        if (/architect|design|ddd|domain|refactor|struct/i.test(lowerText)) {
            domains.push('architecture');
        }
        if (/fix|bug|error|issue|broken|fail|debug/i.test(lowerText)) {
            domains.push('debugging');
        }
        return domains;
    }
    suggestAgent(task) {
        let bestAgent = 'coder';
        let bestConfidence = 70;
        let reasoning = 'Default agent for general tasks';
        for (const [agent, pattern] of Object.entries(AGENT_PATTERNS)) {
            if (pattern.test(task)) {
                const matches = task.match(pattern);
                const confidence = 85 + (matches ? Math.min(matches.length * 5, 13) : 0);
                if (confidence > bestConfidence) {
                    bestAgent = agent;
                    bestConfidence = confidence;
                    reasoning = `Task matches ${agent} patterns`;
                }
            }
        }
        return { agent: bestAgent, confidence: bestConfidence, reasoning };
    }
    calculateQuality(pattern) {
        if (pattern.usageCount === 0)
            return 0.5;
        const successRate = pattern.successCount / pattern.usageCount;
        return 0.3 + successRate * 0.7; // Range: 0.3 to 1.0
    }
    shouldPromote(pattern) {
        return (pattern.usageCount >= this.config.promotionThreshold &&
            pattern.quality >= this.config.qualityThreshold);
    }
    checkPromotion(pattern) {
        if (this.shortTermPatterns.has(pattern.id) && this.shouldPromote(pattern)) {
            this.promotePattern(pattern);
        }
    }
    async promotePattern(pattern) {
        // Move from short-term to long-term
        this.shortTermPatterns.delete(pattern.id);
        this.longTermPatterns.set(pattern.id, pattern);
        // Update storage
        await this.deleteFromStorage(pattern.id);
        await this.storeInAgentDB(pattern, 'long_term');
        this.metrics.promotions++;
        this.emit('pattern:promoted', { id: pattern.id });
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 0 ? dot / denom : 0;
    }
}
/**
 * Real embedding service using @claude-flow/embeddings
 */
class RealEmbeddingService {
    service = null;
    dimensions;
    cache = new Map();
    constructor(dimensions = 384) {
        this.dimensions = dimensions;
    }
    async initialize() {
        if (EmbeddingServiceImpl) {
            this.service = await EmbeddingServiceImpl({
                provider: 'transformers',
                model: 'Xenova/all-MiniLM-L6-v2',
                dimensions: this.dimensions,
                cacheSize: 1000,
            });
        }
    }
    async embed(text) {
        const cacheKey = text.slice(0, 200);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        if (this.service) {
            const result = await this.service.embed(text);
            const embedding = result.embedding;
            this.cache.set(cacheKey, embedding);
            return embedding;
        }
        throw new Error('Embedding service not initialized');
    }
}
/**
 * Fallback embedding service (hash-based)
 */
class FallbackEmbeddingService {
    dimensions;
    cache = new Map();
    constructor(dimensions = 384) {
        this.dimensions = dimensions;
    }
    async embed(text) {
        const cacheKey = text.slice(0, 200);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        // Try agentic-flow ONNX embeddings first
        try {
            const { execFileSync } = await import('child_process');
            // Use execFileSync with shell: false to prevent command injection
            // Pass text as argument array to avoid shell interpolation
            const safeText = text.slice(0, 500).replace(/[\x00-\x1f]/g, ''); // Remove control chars
            const result = execFileSync('npx', ['agentic-flow@alpha', 'embeddings', 'generate', safeText, '--format', 'json'], { encoding: 'utf-8', timeout: 10000, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
            const parsed = JSON.parse(result);
            const embedding = new Float32Array(parsed.embedding || parsed);
            this.cache.set(cacheKey, embedding);
            return embedding;
        }
        catch {
            // Fallback to hash-based embedding
            return this.hashEmbed(text);
        }
    }
    hashEmbed(text) {
        const embedding = new Float32Array(this.dimensions);
        const normalized = text.toLowerCase().trim();
        for (let i = 0; i < this.dimensions; i++) {
            let hash = 0;
            for (let j = 0; j < normalized.length; j++) {
                hash = ((hash << 5) - hash + normalized.charCodeAt(j) * (i + 1)) | 0;
            }
            embedding[i] = (Math.sin(hash) + 1) / 2;
        }
        // Normalize
        let norm = 0;
        for (let i = 0; i < this.dimensions; i++) {
            norm += embedding[i] * embedding[i];
        }
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (let i = 0; i < this.dimensions; i++) {
                embedding[i] /= norm;
            }
        }
        this.cache.set(text.slice(0, 200), embedding);
        return embedding;
    }
}
// Export singleton instance
export const reasoningBank = new ReasoningBank();
//# sourceMappingURL=index.js.map