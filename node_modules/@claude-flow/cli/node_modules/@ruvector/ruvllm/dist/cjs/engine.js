"use strict";
/**
 * RuvLLM Engine - Main orchestrator for self-learning LLM
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuvLLM = void 0;
const native_1 = require("./native");
/**
 * Convert JS config to native config format
 */
function toNativeConfig(config) {
    if (!config)
        return undefined;
    return {
        embedding_dim: config.embeddingDim,
        router_hidden_dim: config.routerHiddenDim,
        hnsw_m: config.hnswM,
        hnsw_ef_construction: config.hnswEfConstruction,
        hnsw_ef_search: config.hnswEfSearch,
        learning_enabled: config.learningEnabled,
        quality_threshold: config.qualityThreshold,
        ewc_lambda: config.ewcLambda,
    };
}
/**
 * Convert JS generation config to native format
 */
function toNativeGenConfig(config) {
    if (!config)
        return undefined;
    return {
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        top_k: config.topK,
        repetition_penalty: config.repetitionPenalty,
    };
}
/**
 * RuvLLM - Self-learning LLM orchestrator
 *
 * Combines SONA adaptive learning with HNSW memory,
 * FastGRNN routing, and SIMD-optimized inference.
 *
 * @example
 * ```typescript
 * import { RuvLLM } from '@ruvector/ruvllm';
 *
 * const llm = new RuvLLM({ embeddingDim: 768 });
 *
 * // Query with automatic routing
 * const response = await llm.query('What is machine learning?');
 * console.log(response.text);
 *
 * // Provide feedback for learning
 * llm.feedback({ requestId: response.requestId, rating: 5 });
 * ```
 */
class RuvLLM {
    /**
     * Create a new RuvLLM instance
     */
    constructor(config) {
        this.native = null;
        // Fallback state for when native module is not available
        this.fallbackState = {
            memory: new Map(),
            nextId: 1,
            queryCount: 0,
        };
        this.config = config ?? {};
        const mod = (0, native_1.getNativeModule)();
        if (mod) {
            try {
                this.native = new mod.RuvLLMEngine(toNativeConfig(config));
            }
            catch {
                // Silently fall back to JS implementation
            }
        }
    }
    /**
     * Query the LLM with automatic routing
     */
    query(text, config) {
        if (this.native) {
            const result = this.native.query(text, toNativeGenConfig(config));
            return {
                text: result.text,
                confidence: result.confidence,
                model: result.model,
                contextSize: result.context_size,
                latencyMs: result.latency_ms,
                requestId: result.request_id,
            };
        }
        // Fallback implementation
        this.fallbackState.queryCount++;
        return {
            text: `[Fallback] Response to: ${text.slice(0, 50)}...`,
            confidence: 0.5,
            model: 'fallback',
            contextSize: 512,
            latencyMs: 1.0,
            requestId: `fb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
    }
    /**
     * Generate text with SIMD-optimized inference
     *
     * Note: If no trained model is loaded (demo mode), returns an informational
     * message instead of garbled output.
     */
    generate(prompt, config) {
        if (this.native) {
            return this.native.generate(prompt, toNativeGenConfig(config));
        }
        // Fallback - provide helpful message instead of garbled output
        const maxTokens = config?.maxTokens ?? 256;
        const temp = config?.temperature ?? 0.7;
        const topP = config?.topP ?? 0.9;
        return `[RuvLLM JavaScript Fallback Mode]
No native SIMD module loaded. Running in JavaScript fallback mode.

Your prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"

To enable native SIMD inference:
1. Install the native bindings: npm install @ruvector/ruvllm-${process.platform}-${process.arch}
2. Or load a GGUF model file
3. Or connect to an external LLM API

Config: temp=${temp.toFixed(2)}, top_p=${topP.toFixed(2)}, max_tokens=${maxTokens}

This fallback provides routing, memory, and embedding features but not full text generation.`;
    }
    /**
     * Get routing decision for a query
     */
    route(text) {
        if (this.native) {
            const result = this.native.route(text);
            return {
                model: result.model,
                contextSize: result.context_size,
                temperature: result.temperature,
                topP: result.top_p,
                confidence: result.confidence,
            };
        }
        // Fallback
        return {
            model: 'M700',
            contextSize: 512,
            temperature: 0.7,
            topP: 0.9,
            confidence: 0.5,
        };
    }
    /**
     * Search memory for similar content
     */
    searchMemory(text, k = 10) {
        if (this.native) {
            const results = this.native.searchMemory(text, k);
            return results.map(r => ({
                id: r.id,
                score: r.score,
                content: r.content,
                metadata: JSON.parse(r.metadata || '{}'),
            }));
        }
        // Fallback - simple search
        return Array.from(this.fallbackState.memory.entries())
            .slice(0, k)
            .map(([id, data]) => ({
            id,
            score: 0.5,
            content: data.content,
            metadata: data.metadata,
        }));
    }
    /**
     * Add content to memory
     */
    addMemory(content, metadata) {
        if (this.native) {
            return this.native.addMemory(content, metadata ? JSON.stringify(metadata) : undefined);
        }
        // Fallback
        const id = this.fallbackState.nextId++;
        this.fallbackState.memory.set(id, {
            content,
            embedding: this.embed(content),
            metadata: metadata ?? {},
        });
        return id;
    }
    /**
     * Provide feedback for learning
     */
    feedback(fb) {
        if (this.native) {
            return this.native.feedback(fb.requestId, fb.rating, fb.correction);
        }
        return false;
    }
    /**
     * Get engine statistics
     */
    stats() {
        if (this.native) {
            const s = this.native.stats();
            // Map native stats (snake_case) to TypeScript interface (camelCase)
            // Handle both old and new field names for backward compatibility
            return {
                totalQueries: s.total_queries ?? 0,
                memoryNodes: s.memory_nodes ?? 0,
                patternsLearned: s.patterns_learned ?? s.training_steps ?? 0,
                avgLatencyMs: s.avg_latency_ms ?? 0,
                cacheHitRate: s.cache_hit_rate ?? 0,
                routerAccuracy: s.router_accuracy ?? 0.5,
            };
        }
        // Fallback
        return {
            totalQueries: this.fallbackState.queryCount,
            memoryNodes: this.fallbackState.memory.size,
            patternsLearned: 0,
            avgLatencyMs: 1.0,
            cacheHitRate: 0.0,
            routerAccuracy: 0.5,
        };
    }
    /**
     * Force router learning cycle
     */
    forceLearn() {
        if (this.native) {
            return this.native.forceLearn();
        }
        return 'Learning not available in fallback mode';
    }
    /**
     * Get embedding for text
     */
    embed(text) {
        if (this.native) {
            return this.native.embed(text);
        }
        // Fallback - simple hash-based embedding
        const dim = this.config.embeddingDim ?? 768;
        const embedding = new Array(dim).fill(0);
        for (let i = 0; i < text.length; i++) {
            const idx = (text.charCodeAt(i) * (i + 1)) % dim;
            embedding[idx] += 0.1;
        }
        // Normalize
        const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0)) || 1;
        return embedding.map(x => x / norm);
    }
    /**
     * Compute similarity between two texts
     */
    similarity(text1, text2) {
        if (this.native) {
            return this.native.similarity(text1, text2);
        }
        // Fallback - cosine similarity
        const emb1 = this.embed(text1);
        const emb2 = this.embed(text2);
        let dot = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < emb1.length; i++) {
            dot += emb1[i] * emb2[i];
            norm1 += emb1[i] * emb1[i];
            norm2 += emb2[i] * emb2[i];
        }
        const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
        const similarity = denom > 0 ? dot / denom : 0;
        // Clamp to [0, 1] to handle floating point errors
        return Math.max(0, Math.min(1, similarity));
    }
    /**
     * Check if SIMD is available
     */
    hasSimd() {
        if (this.native) {
            return this.native.hasSimd();
        }
        return false;
    }
    /**
     * Get SIMD capabilities
     */
    simdCapabilities() {
        if (this.native) {
            return this.native.simdCapabilities();
        }
        return ['Scalar (fallback)'];
    }
    /**
     * Batch query multiple prompts
     */
    batchQuery(request) {
        const start = Date.now();
        const responses = request.queries.map(q => this.query(q, request.config));
        return {
            responses,
            totalLatencyMs: Date.now() - start,
        };
    }
    /**
     * Check if native module is loaded
     */
    isNativeLoaded() {
        return this.native !== null;
    }
}
exports.RuvLLM = RuvLLM;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5naW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2VuZ2luZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQWVILHFDQUtrQjtBQUVsQjs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLE1BQXFCO0lBQzNDLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFFOUIsT0FBTztRQUNMLGFBQWEsRUFBRSxNQUFNLENBQUMsWUFBWTtRQUNsQyxpQkFBaUIsRUFBRSxNQUFNLENBQUMsZUFBZTtRQUN6QyxNQUFNLEVBQUUsTUFBTSxDQUFDLEtBQUs7UUFDcEIsb0JBQW9CLEVBQUUsTUFBTSxDQUFDLGtCQUFrQjtRQUMvQyxjQUFjLEVBQUUsTUFBTSxDQUFDLFlBQVk7UUFDbkMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLGVBQWU7UUFDeEMsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLGdCQUFnQjtRQUMxQyxVQUFVLEVBQUUsTUFBTSxDQUFDLFNBQVM7S0FDN0IsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsaUJBQWlCLENBQUMsTUFBeUI7SUFDbEQsSUFBSSxDQUFDLE1BQU07UUFBRSxPQUFPLFNBQVMsQ0FBQztJQUU5QixPQUFPO1FBQ0wsVUFBVSxFQUFFLE1BQU0sQ0FBQyxTQUFTO1FBQzVCLFdBQVcsRUFBRSxNQUFNLENBQUMsV0FBVztRQUMvQixLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUk7UUFDbEIsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJO1FBQ2xCLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxpQkFBaUI7S0FDN0MsQ0FBQztBQUNKLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW1CRztBQUNILE1BQWEsTUFBTTtJQVdqQjs7T0FFRztJQUNILFlBQVksTUFBcUI7UUFiekIsV0FBTSxHQUF3QixJQUFJLENBQUM7UUFHM0MseURBQXlEO1FBQ2pELGtCQUFhLEdBQUc7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OztPQUVHO0lBQ0gsZ0JBQWdCO1FBQ2QsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEMsQ0FBQztRQUNELE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVUsQ0FBQyxPQUEwQjtRQUNuQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDekIsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUMxRSxPQUFPO1lBQ0wsU0FBUztZQUNULGNBQWMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsS0FBSztTQUNuQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsY0FBYztRQUNaLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUM7SUFDOUIsQ0FBQztDQUNGO0FBblNELHdCQW1TQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUnV2TExNIEVuZ2luZSAtIE1haW4gb3JjaGVzdHJhdG9yIGZvciBzZWxmLWxlYXJuaW5nIExMTVxuICovXG5cbmltcG9ydCB7XG4gIFJ1dkxMTUNvbmZpZyxcbiAgR2VuZXJhdGlvbkNvbmZpZyxcbiAgUXVlcnlSZXNwb25zZSxcbiAgUm91dGluZ0RlY2lzaW9uLFxuICBNZW1vcnlSZXN1bHQsXG4gIFJ1dkxMTVN0YXRzLFxuICBGZWVkYmFjayxcbiAgRW1iZWRkaW5nLFxuICBCYXRjaFF1ZXJ5UmVxdWVzdCxcbiAgQmF0Y2hRdWVyeVJlc3BvbnNlLFxufSBmcm9tICcuL3R5cGVzJztcblxuaW1wb3J0IHtcbiAgZ2V0TmF0aXZlTW9kdWxlLFxuICBOYXRpdmVFbmdpbmUsXG4gIE5hdGl2ZUNvbmZpZyxcbiAgTmF0aXZlR2VuQ29uZmlnLFxufSBmcm9tICcuL25hdGl2ZSc7XG5cbi8qKlxuICogQ29udmVydCBKUyBjb25maWcgdG8gbmF0aXZlIGNvbmZpZyBmb3JtYXRcbiAqL1xuZnVuY3Rpb24gdG9OYXRpdmVDb25maWcoY29uZmlnPzogUnV2TExNQ29uZmlnKTogTmF0aXZlQ29uZmlnIHwgdW5kZWZpbmVkIHtcbiAgaWYgKCFjb25maWcpIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgcmV0dXJuIHtcbiAgICBlbWJlZGRpbmdfZGltOiBjb25maWcuZW1iZWRkaW5nRGltLFxuICAgIHJvdXRlcl9oaWRkZW5fZGltOiBjb25maWcucm91dGVySGlkZGVuRGltLFxuICAgIGhuc3dfbTogY29uZmlnLmhuc3dNLFxuICAgIGhuc3dfZWZfY29uc3RydWN0aW9uOiBjb25maWcuaG5zd0VmQ29uc3RydWN0aW9uLFxuICAgIGhuc3dfZWZfc2VhcmNoOiBjb25maWcuaG5zd0VmU2VhcmNoLFxuICAgIGxlYXJuaW5nX2VuYWJsZWQ6IGNvbmZpZy5sZWFybmluZ0VuYWJsZWQsXG4gICAgcXVhbGl0eV90aHJlc2hvbGQ6IGNvbmZpZy5xdWFsaXR5VGhyZXNob2xkLFxuICAgIGV3Y19sYW1iZGE6IGNvbmZpZy5ld2NMYW1iZGEsXG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCBKUyBnZW5lcmF0aW9uIGNvbmZpZyB0byBuYXRpdmUgZm9ybWF0XG4gKi9cbmZ1bmN0aW9uIHRvTmF0aXZlR2VuQ29uZmlnKGNvbmZpZz86IEdlbmVyYXRpb25Db25maWcpOiBOYXRpdmVHZW5Db25maWcgfCB1bmRlZmluZWQge1xuICBpZiAoIWNvbmZpZykgcmV0dXJuIHVuZGVmaW5lZDtcblxuICByZXR1cm4ge1xuICAgIG1heF90b2tlbnM6IGNvbmZpZy5tYXhUb2tlbnMsXG4gICAgdGVtcGVyYXR1cmU6IGNvbmZpZy50ZW1wZXJhdHVyZSxcbiAgICB0b3BfcDogY29uZmlnLnRvcFAsXG4gICAgdG9wX2s6IGNvbmZpZy50b3BLLFxuICAgIHJlcGV0aXRpb25fcGVuYWx0eTogY29uZmlnLnJlcGV0aXRpb25QZW5hbHR5LFxuICB9O1xufVxuXG4vKipcbiAqIFJ1dkxMTSAtIFNlbGYtbGVhcm5pbmcgTExNIG9yY2hlc3RyYXRvclxuICpcbiAqIENvbWJpbmVzIFNPTkEgYWRhcHRpdmUgbGVhcm5pbmcgd2l0aCBITlNXIG1lbW9yeSxcbiAqIEZhc3RHUk5OIHJvdXRpbmcsIGFuZCBTSU1ELW9wdGltaXplZCBpbmZlcmVuY2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IFJ1dkxMTSB9IGZyb20gJ0BydXZlY3Rvci9ydXZsbG0nO1xuICpcbiAqIGNvbnN0IGxsbSA9IG5ldyBSdXZMTE0oeyBlbWJlZGRpbmdEaW06IDc2OCB9KTtcbiAqXG4gKiAvLyBRdWVyeSB3aXRoIGF1dG9tYXRpYyByb3V0aW5nXG4gKiBjb25zdCByZXNwb25zZSA9IGF3YWl0IGxsbS5xdWVyeSgnV2hhdCBpcyBtYWNoaW5lIGxlYXJuaW5nPycpO1xuICogY29uc29sZS5sb2cocmVzcG9uc2UudGV4dCk7XG4gKlxuICogLy8gUHJvdmlkZSBmZWVkYmFjayBmb3IgbGVhcm5pbmdcbiAqIGxsbS5mZWVkYmFjayh7IHJlcXVlc3RJZDogcmVzcG9uc2UucmVxdWVzdElkLCByYXRpbmc6IDUgfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFJ1dkxMTSB7XG4gIHByaXZhdGUgbmF0aXZlOiBOYXRpdmVFbmdpbmUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjb25maWc6IFJ1dkxMTUNvbmZpZztcblxuICAvLyBGYWxsYmFjayBzdGF0ZSBmb3Igd2hlbiBuYXRpdmUgbW9kdWxlIGlzIG5vdCBhdmFpbGFibGVcbiAgcHJpdmF0ZSBmYWxsYmFja1N0YXRlID0ge1xuICAgIG1lbW9yeTogbmV3IE1hcDxudW1iZXIsIHsgY29udGVudDogc3RyaW5nOyBlbWJlZGRpbmc6IG51bWJlcltdOyBtZXRhZGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfT4oKSxcbiAgICBuZXh0SWQ6IDEsXG4gICAgcXVlcnlDb3VudDogMCxcbiAgfTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFJ1dkxMTSBpbnN0YW5jZVxuICAgKi9cbiAgY29uc3RydWN0b3IoY29uZmlnPzogUnV2TExNQ29uZmlnKSB7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWcgPz8ge307XG5cbiAgICBjb25zdCBtb2QgPSBnZXROYXRpdmVNb2R1bGUoKTtcbiAgICBpZiAobW9kKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLm5hdGl2ZSA9IG5ldyBtb2QuUnV2TExNRW5naW5lKHRvTmF0aXZlQ29uZmlnKGNvbmZpZykpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIFNpbGVudGx5IGZhbGwgYmFjayB0byBKUyBpbXBsZW1lbnRhdGlvblxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBRdWVyeSB0aGUgTExNIHdpdGggYXV0b21hdGljIHJvdXRpbmdcbiAgICovXG4gIHF1ZXJ5KHRleHQ6IHN0cmluZywgY29uZmlnPzogR2VuZXJhdGlvbkNvbmZpZyk6IFF1ZXJ5UmVzcG9uc2Uge1xuICAgIGlmICh0aGlzLm5hdGl2ZSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5uYXRpdmUucXVlcnkodGV4dCwgdG9OYXRpdmVHZW5Db25maWcoY29uZmlnKSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0ZXh0OiByZXN1bHQudGV4dCxcbiAgICAgICAgY29uZmlkZW5jZTogcmVzdWx0LmNvbmZpZGVuY2UsXG4gICAgICAgIG1vZGVsOiByZXN1bHQubW9kZWwsXG4gICAgICAgIGNvbnRleHRTaXplOiByZXN1bHQuY29udGV4dF9zaXplLFxuICAgICAgICBsYXRlbmN5TXM6IHJlc3VsdC5sYXRlbmN5X21zLFxuICAgICAgICByZXF1ZXN0SWQ6IHJlc3VsdC5yZXF1ZXN0X2lkLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFjayBpbXBsZW1lbnRhdGlvblxuICAgIHRoaXMuZmFsbGJhY2tTdGF0ZS5xdWVyeUNvdW50Kys7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6IGBbRmFsbGJhY2tdIFJlc3BvbnNlIHRvOiAke3RleHQuc2xpY2UoMCwgNTApfS4uLmAsXG4gICAgICBjb25maWRlbmNlOiAwLjUsXG4gICAgICBtb2RlbDogJ2ZhbGxiYWNrJyxcbiAgICAgIGNvbnRleHRTaXplOiA1MTIsXG4gICAgICBsYXRlbmN5TXM6IDEuMCxcbiAgICAgIHJlcXVlc3RJZDogYGZiLSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKX1gLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgdGV4dCB3aXRoIFNJTUQtb3B0aW1pemVkIGluZmVyZW5jZVxuICAgKlxuICAgKiBOb3RlOiBJZiBubyB0cmFpbmVkIG1vZGVsIGlzIGxvYWRlZCAoZGVtbyBtb2RlKSwgcmV0dXJucyBhbiBpbmZvcm1hdGlvbmFsXG4gICAqIG1lc3NhZ2UgaW5zdGVhZCBvZiBnYXJibGVkIG91dHB1dC5cbiAgICovXG4gIGdlbmVyYXRlKHByb21wdDogc3RyaW5nLCBjb25maWc/OiBHZW5lcmF0aW9uQ29uZmlnKTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5uYXRpdmUpIHtcbiAgICAgIHJldHVybiB0aGlzLm5hdGl2ZS5nZW5lcmF0ZShwcm9tcHQsIHRvTmF0aXZlR2VuQ29uZmlnKGNvbmZpZykpO1xuICAgIH1cblxuICAgIC8vIEZhbGxiYWNrIC0gcHJvdmlkZSBoZWxwZnVsIG1lc3NhZ2UgaW5zdGVhZCBvZiBnYXJibGVkIG91dHB1dFxuICAgIGNvbnN0IG1heFRva2VucyA9IGNvbmZpZz8ubWF4VG9rZW5zID8/IDI1NjtcbiAgICBjb25zdCB0ZW1wID0gY29uZmlnPy50ZW1wZXJhdHVyZSA/PyAwLjc7XG4gICAgY29uc3QgdG9wUCA9IGNvbmZpZz8udG9wUCA/PyAwLjk7XG5cbiAgICByZXR1cm4gYFtSdXZMTE0gSmF2YVNjcmlwdCBGYWxsYmFjayBNb2RlXVxuTm8gbmF0aXZlIFNJTUQgbW9kdWxlIGxvYWRlZC4gUnVubmluZyBpbiBKYXZhU2NyaXB0IGZhbGxiYWNrIG1vZGUuXG5cbllvdXIgcHJvbXB0OiBcIiR7cHJvbXB0LnNsaWNlKDAsIDEwMCl9JHtwcm9tcHQubGVuZ3RoID4gMTAwID8gJy4uLicgOiAnJ31cIlxuXG5UbyBlbmFibGUgbmF0aXZlIFNJTUQgaW5mZXJlbmNlOlxuMS4gSW5zdGFsbCB0aGUgbmF0aXZlIGJpbmRpbmdzOiBucG0gaW5zdGFsbCBAcnV2ZWN0b3IvcnV2bGxtLSR7cHJvY2Vzcy5wbGF0Zm9ybX0tJHtwcm9jZXNzLmFyY2h9XG4yLiBPciBsb2FkIGEgR0dVRiBtb2RlbCBmaWxlXG4zLiBPciBjb25uZWN0IHRvIGFuIGV4dGVybmFsIExMTSBBUElcblxuQ29uZmlnOiB0ZW1wPSR7dGVtcC50b0ZpeGVkKDIpfSwgdG9wX3A9JHt0b3BQLnRvRml4ZWQoMil9LCBtYXhfdG9rZW5zPSR7bWF4VG9rZW5zfVxuXG5UaGlzIGZhbGxiYWNrIHByb3ZpZGVzIHJvdXRpbmcsIG1lbW9yeSwgYW5kIGVtYmVkZGluZyBmZWF0dXJlcyBidXQgbm90IGZ1bGwgdGV4dCBnZW5lcmF0aW9uLmA7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHJvdXRpbmcgZGVjaXNpb24gZm9yIGEgcXVlcnlcbiAgICovXG4gIHJvdXRlKHRleHQ6IHN0cmluZyk6IFJvdXRpbmdEZWNpc2lvbiB7XG4gICAgaWYgKHRoaXMubmF0aXZlKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLm5hdGl2ZS5yb3V0ZSh0ZXh0KTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1vZGVsOiByZXN1bHQubW9kZWwgYXMgYW55LFxuICAgICAgICBjb250ZXh0U2l6ZTogcmVzdWx0LmNvbnRleHRfc2l6ZSxcbiAgICAgICAgdGVtcGVyYXR1cmU6IHJlc3VsdC50ZW1wZXJhdHVyZSxcbiAgICAgICAgdG9wUDogcmVzdWx0LnRvcF9wLFxuICAgICAgICBjb25maWRlbmNlOiByZXN1bHQuY29uZmlkZW5jZSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRmFsbGJhY2tcbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWw6ICdNNzAwJyxcbiAgICAgIGNvbnRleHRTaXplOiA1MTIsXG4gICAgICB0ZW1wZXJhdHVyZTogMC43LFxuICAgICAgdG9wUDogMC45LFxuICAgICAgY29uZmlkZW5jZTogMC41LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogU2VhcmNoIG1lbW9yeSBmb3Igc2ltaWxhciBjb250ZW50XG4gICAqL1xuICBzZWFyY2hNZW1vcnkodGV4dDogc3RyaW5nLCBrID0gMTApOiBNZW1vcnlSZXN1bHRbXSB7XG4gICAgaWYgKHRoaXMubmF0aXZlKSB7XG4gICAgICBjb25zdCByZXN1bHRzID0gdGhpcy5uYXRpdmUuc2VhcmNoTWVtb3J5KHRleHQsIGspO1xuICAgICAgcmV0dXJuIHJlc3VsdHMubWFwKHIgPT4gKHtcbiAgICAgICAgaWQ6IHIuaWQsXG4gICAgICAgIHNjb3JlOiByLnNjb3JlLFxuICAgICAgICBjb250ZW50OiByLmNvbnRlbnQsXG4gICAgICAgIG1ldGFkYXRhOiBKU09OLnBhcnNlKHIubWV0YWRhdGEgfHwgJ3t9JyksXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgLy8gRmFsbGJhY2sgLSBzaW1wbGUgc2VhcmNoXG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5mYWxsYmFja1N0YXRlLm1lbW9yeS5lbnRyaWVzKCkpXG4gICAgICAuc2xpY2UoMCwgaylcbiAgICAgIC5tYXAoKFtpZCwgZGF0YV0pID0+ICh7XG4gICAgICAgIGlkLFxuICAgICAgICBzY29yZTogMC41LFxuICAgICAgICBjb250ZW50OiBkYXRhLmNvbnRlbnQsXG4gICAgICAgIG1ldGFkYXRhOiBkYXRhLm1ldGFkYXRhLFxuICAgICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBjb250ZW50IHRvIG1lbW9yeVxuICAgKi9cbiAgYWRkTWVtb3J5KGNvbnRlbnQ6IHN0cmluZywgbWV0YWRhdGE/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IG51bWJlciB7XG4gICAgaWYgKHRoaXMubmF0aXZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5uYXRpdmUuYWRkTWVtb3J5KGNvbnRlbnQsIG1ldGFkYXRhID8gSlNPTi5zdHJpbmdpZnkobWV0YWRhdGEpIDogdW5kZWZpbmVkKTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFja1xuICAgIGNvbnN0IGlkID0gdGhpcy5mYWxsYmFja1N0YXRlLm5leHRJZCsrO1xuICAgIHRoaXMuZmFsbGJhY2tTdGF0ZS5tZW1vcnkuc2V0KGlkLCB7XG4gICAgICBjb250ZW50LFxuICAgICAgZW1iZWRkaW5nOiB0aGlzLmVtYmVkKGNvbnRlbnQpLFxuICAgICAgbWV0YWRhdGE6IG1ldGFkYXRhID8/IHt9LFxuICAgIH0pO1xuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm92aWRlIGZlZWRiYWNrIGZvciBsZWFybmluZ1xuICAgKi9cbiAgZmVlZGJhY2soZmI6IEZlZWRiYWNrKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMubmF0aXZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5uYXRpdmUuZmVlZGJhY2soZmIucmVxdWVzdElkLCBmYi5yYXRpbmcsIGZiLmNvcnJlY3Rpb24pO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGVuZ2luZSBzdGF0aXN0aWNzXG4gICAqL1xuICBzdGF0cygpOiBSdXZMTE1TdGF0cyB7XG4gICAgaWYgKHRoaXMubmF0aXZlKSB7XG4gICAgICBjb25zdCBzID0gdGhpcy5uYXRpdmUuc3RhdHMoKTtcbiAgICAgIC8vIE1hcCBuYXRpdmUgc3RhdHMgKHNuYWtlX2Nhc2UpIHRvIFR5cGVTY3JpcHQgaW50ZXJmYWNlIChjYW1lbENhc2UpXG4gICAgICAvLyBIYW5kbGUgYm90aCBvbGQgYW5kIG5ldyBmaWVsZCBuYW1lcyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG90YWxRdWVyaWVzOiBzLnRvdGFsX3F1ZXJpZXMgPz8gMCxcbiAgICAgICAgbWVtb3J5Tm9kZXM6IHMubWVtb3J5X25vZGVzID8/IDAsXG4gICAgICAgIHBhdHRlcm5zTGVhcm5lZDogcy5wYXR0ZXJuc19sZWFybmVkID8/IChzIGFzIGFueSkudHJhaW5pbmdfc3RlcHMgPz8gMCxcbiAgICAgICAgYXZnTGF0ZW5jeU1zOiBzLmF2Z19sYXRlbmN5X21zID8/IDAsXG4gICAgICAgIGNhY2hlSGl0UmF0ZTogcy5jYWNoZV9oaXRfcmF0ZSA/PyAwLFxuICAgICAgICByb3V0ZXJBY2N1cmFjeTogcy5yb3V0ZXJfYWNjdXJhY3kgPz8gMC41LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFja1xuICAgIHJldHVybiB7XG4gICAgICB0b3RhbFF1ZXJpZXM6IHRoaXMuZmFsbGJhY2tTdGF0ZS5xdWVyeUNvdW50LFxuICAgICAgbWVtb3J5Tm9kZXM6IHRoaXMuZmFsbGJhY2tTdGF0ZS5tZW1vcnkuc2l6ZSxcbiAgICAgIHBhdHRlcm5zTGVhcm5lZDogMCxcbiAgICAgIGF2Z0xhdGVuY3lNczogMS4wLFxuICAgICAgY2FjaGVIaXRSYXRlOiAwLjAsXG4gICAgICByb3V0ZXJBY2N1cmFjeTogMC41LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRm9yY2Ugcm91dGVyIGxlYXJuaW5nIGN5Y2xlXG4gICAqL1xuICBmb3JjZUxlYXJuKCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMubmF0aXZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5uYXRpdmUuZm9yY2VMZWFybigpO1xuICAgIH1cbiAgICByZXR1cm4gJ0xlYXJuaW5nIG5vdCBhdmFpbGFibGUgaW4gZmFsbGJhY2sgbW9kZSc7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGVtYmVkZGluZyBmb3IgdGV4dFxuICAgKi9cbiAgZW1iZWQodGV4dDogc3RyaW5nKTogRW1iZWRkaW5nIHtcbiAgICBpZiAodGhpcy5uYXRpdmUpIHtcbiAgICAgIHJldHVybiB0aGlzLm5hdGl2ZS5lbWJlZCh0ZXh0KTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFjayAtIHNpbXBsZSBoYXNoLWJhc2VkIGVtYmVkZGluZ1xuICAgIGNvbnN0IGRpbSA9IHRoaXMuY29uZmlnLmVtYmVkZGluZ0RpbSA/PyA3Njg7XG4gICAgY29uc3QgZW1iZWRkaW5nID0gbmV3IEFycmF5KGRpbSkuZmlsbCgwKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaWR4ID0gKHRleHQuY2hhckNvZGVBdChpKSAqIChpICsgMSkpICUgZGltO1xuICAgICAgZW1iZWRkaW5nW2lkeF0gKz0gMC4xO1xuICAgIH1cblxuICAgIC8vIE5vcm1hbGl6ZVxuICAgIGNvbnN0IG5vcm0gPSBNYXRoLnNxcnQoZW1iZWRkaW5nLnJlZHVjZSgoc3VtLCB4KSA9PiBzdW0gKyB4ICogeCwgMCkpIHx8IDE7XG4gICAgcmV0dXJuIGVtYmVkZGluZy5tYXAoeCA9PiB4IC8gbm9ybSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcHV0ZSBzaW1pbGFyaXR5IGJldHdlZW4gdHdvIHRleHRzXG4gICAqL1xuICBzaW1pbGFyaXR5KHRleHQxOiBzdHJpbmcsIHRleHQyOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGlmICh0aGlzLm5hdGl2ZSkge1xuICAgICAgcmV0dXJuIHRoaXMubmF0aXZlLnNpbWlsYXJpdHkodGV4dDEsIHRleHQyKTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFjayAtIGNvc2luZSBzaW1pbGFyaXR5XG4gICAgY29uc3QgZW1iMSA9IHRoaXMuZW1iZWQodGV4dDEpO1xuICAgIGNvbnN0IGVtYjIgPSB0aGlzLmVtYmVkKHRleHQyKTtcblxuICAgIGxldCBkb3QgPSAwO1xuICAgIGxldCBub3JtMSA9IDA7XG4gICAgbGV0IG5vcm0yID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW1iMS5sZW5ndGg7IGkrKykge1xuICAgICAgZG90ICs9IGVtYjFbaV0gKiBlbWIyW2ldO1xuICAgICAgbm9ybTEgKz0gZW1iMVtpXSAqIGVtYjFbaV07XG4gICAgICBub3JtMiArPSBlbWIyW2ldICogZW1iMltpXTtcbiAgICB9XG5cbiAgICBjb25zdCBkZW5vbSA9IE1hdGguc3FydChub3JtMSkgKiBNYXRoLnNxcnQobm9ybTIpO1xuICAgIGNvbnN0IHNpbWlsYXJpdHkgPSBkZW5vbSA+IDAgPyBkb3QgLyBkZW5vbSA6IDA7XG4gICAgLy8gQ2xhbXAgdG8gWzAsIDFdIHRvIGhhbmRsZSBmbG9hdGluZyBwb2ludCBlcnJvcnNcbiAgICByZXR1cm4gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgc2ltaWxhcml0eSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIFNJTUQgaXMgYXZhaWxhYmxlXG4gICAqL1xuICBoYXNTaW1kKCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLm5hdGl2ZSkge1xuICAgICAgcmV0dXJuIHRoaXMubmF0aXZlLmhhc1NpbWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBTSU1EIGNhcGFiaWxpdGllc1xuICAgKi9cbiAgc2ltZENhcGFiaWxpdGllcygpOiBzdHJpbmdbXSB7XG4gICAgaWYgKHRoaXMubmF0aXZlKSB7XG4gICAgICByZXR1cm4gdGhpcy5uYXRpdmUuc2ltZENhcGFiaWxpdGllcygpO1xuICAgIH1cbiAgICByZXR1cm4gWydTY2FsYXIgKGZhbGxiYWNrKSddO1xuICB9XG5cbiAgLyoqXG4gICAqIEJhdGNoIHF1ZXJ5IG11bHRpcGxlIHByb21wdHNcbiAgICovXG4gIGJhdGNoUXVlcnkocmVxdWVzdDogQmF0Y2hRdWVyeVJlcXVlc3QpOiBCYXRjaFF1ZXJ5UmVzcG9uc2Uge1xuICAgIGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCByZXNwb25zZXMgPSByZXF1ZXN0LnF1ZXJpZXMubWFwKHEgPT4gdGhpcy5xdWVyeShxLCByZXF1ZXN0LmNvbmZpZykpO1xuICAgIHJldHVybiB7XG4gICAgICByZXNwb25zZXMsXG4gICAgICB0b3RhbExhdGVuY3lNczogRGF0ZS5ub3coKSAtIHN0YXJ0LFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgbmF0aXZlIG1vZHVsZSBpcyBsb2FkZWRcbiAgICovXG4gIGlzTmF0aXZlTG9hZGVkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm5hdGl2ZSAhPT0gbnVsbDtcbiAgfVxufVxuIl19