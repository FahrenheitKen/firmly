/**
 * V3 Embedding Service Module
 *
 * Production embedding service aligned with agentic-flow@alpha:
 * - OpenAI provider (text-embedding-3-small/large)
 * - Transformers.js provider (local ONNX models)
 * - Agentic-flow provider (optimized ONNX with SIMD)
 * - Mock provider (development/testing)
 *
 * Additional features:
 * - Persistent SQLite cache
 * - Document chunking with overlap
 * - L2/L1/minmax/zscore normalization
 * - Hyperbolic embeddings (Poincaré ball)
 * - Neural substrate integration (drift, memory, swarm)
 *
 * @module @claude-flow/embeddings
 */

export * from './types.js';
export * from './embedding-service.js';

// Re-export commonly used items at top level
export {
  createEmbeddingService,
  createEmbeddingServiceAsync,
  getEmbedding,
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  computeSimilarity,
  OpenAIEmbeddingService,
  TransformersEmbeddingService,
  MockEmbeddingService,
  AgenticFlowEmbeddingService,
  BaseEmbeddingService,
} from './embedding-service.js';

// ADR-121 Phase 1 — WASM+SIMD ONNX provider via ruvector-onnx-embeddings-wasm.
export {
  RuvectorOnnxEmbeddingService,
  createRuvectorOnnxEmbeddingService,
} from './ruvector-onnx-embedding-service.js';

// ADR-121 Phase 2 — HNSW-backed searchable cache via @ruvector/core.
// Falls back to linear-scan when the optional peer dep isn't installed,
// so the contract holds end-to-end regardless of install state.
export {
  SearchableEmbeddingCache,
  createSearchableEmbeddingCache,
  type CacheSearchHit,
  type SearchableCacheOptions,
} from './searchable-embedding-cache.js';

// ADR-121 Phase 5 (lightweight) — ruvector sidecar availability probe.
// Foundation for the full MCP sidecar wire-up (which lives in the CLI
// package). Consumers: `ruflo doctor`, new
// `embeddings_check_ruvector_sidecar` MCP tool (follow-up).
export {
  probeRuvectorSidecar,
  formatRuvectorAvailability,
  type RuvectorAvailability,
  type RuvectorMcpTool,
  type RuvectorProbeOptions,
} from './ruvector-mcp-probe.js';

// ADR-121 Phase 3 — quantization.
//   int8        : 4× memory reduction, streaming-insert friendly,
//                 wired into SearchableEmbeddingCache via
//                 `quantize: 'int8'`. Recall ≥0.98 on unit-normalized
//                 vectors.
//   RabitqSnapshot : 32× memory reduction, batch-build only (suits
//                 fixed corpora — agent-fleet shared memory, etc.).
//                 Requires @ruvector/rabitq-wasm as an optional peer.
export {
  int8Encode,
  int8Decode,
  measureInt8RoundTripRecall,
  RabitqSnapshot,
  rabitqMemoryReduction,
  type Int8EncodedVector,
  type RabitqSnapshotOptions,
  type RabitqSnapshotHit,
} from './quantization.js';

// ADR-121 Phase 5b — `@ruvector/diskann` snapshot for billion-scale
// agent-fleet caches. Streaming insert + on-disk persistence
// (survives process restarts). Complements RabitqSnapshot (in-memory,
// build-once, 32× compression) — DiskannSnapshot is the right tool
// when the corpus outgrows RAM.
export {
  DiskannSnapshot,
  diskannAvailable,
  type DiskannSnapshotOptions,
  type DiskannSnapshotHit,
} from './diskann-snapshot.js';

// ADR-121 Phase 8 — AnnRouter composition. Auto-selects between
// HNSW (streaming/mutable), RaBitQ (batch/memory-tight), and DiskANN
// (persistent/billion-scale) based on the workload descriptor. Single
// unified search interface; degrades cleanly when the preferred
// backing's peer dep isn't installed.
export {
  AnnRouter,
  decideBacking,
  type AnnBacking,
  type AnnRouterWorkload,
  type AnnRouterHit,
  type AnnRouterDecision,
} from './ann-router.js';

// ADR-121 Phase 10 — Maximal Marginal Relevance diversity rerank.
// Pure function; takes (candidates, queryVec, {k, lambda}) and returns
// a diversified subset. Composable with any of the ANN backings.
export {
  mmrRerank,
  mmrIds,
  averagePairwiseSimilarity,
  type MmrCandidate,
  type MmrOptions,
  type MmrPickedHit,
} from './mmr.js';

// ADR-121 Phase 11 — Reciprocal Rank Fusion (Cormack-Clarke-Büttcher 2009).
// Combines N ranked lists into a single fused ranking without needing
// score comparability. Composes with `embeddings_search_text_batch`
// for ensemble RAG.
export {
  reciprocalRankFusion,
  rrfIds,
  type RrfListItem,
  type RrfOptions,
  type RrfFusedHit,
} from './rrf.js';

// ADR-121 Phase 12 — Embedding-level fusion (HyDE, Gao et al. 2022).
// Averages N embedding vectors into a single query vector — fuses at
// the embedding level (one search after average) vs RRF which fuses
// at the rank level (N searches then merge). Standard HyDE recipe
// for zero-shot dense retrieval. Composes with any retrieval shape.
export {
  averageEmbeddings,
  isUnitNorm,
  type AverageEmbeddingsOptions,
} from './embedding-fusion.js';

// ADR-121 Phase 17 — Hybrid sparse+dense retrieval.
// Composes BM25 (sparse lexical) + dense vector search via RRF.
// Standard production fix for the "dense embeddings underweight
// rare/technical terms" failure mode.
export {
  hybridRetrieval,
  type HybridRetrievalOptions,
  type HybridRetrievalDiagnostics,
  type HybridRetrievalResult,
} from './hybrid-retrieval.js';

// ADR-121 Phase 17 — Sparse lexical retrieval (Okapi BM25).
// Pure-function BM25 — composes with dense vector retrieval via the
// Phase 11 RRF primitive for hybrid sparse+dense search. The
// standard production fix for the "dense embeddings underweight
// rare technical tokens" failure mode.
export {
  tokenize,
  buildBm25Index,
  bm25Score,
  bm25TopK,
  idfOf,
  queryMeanIdf,
  type Bm25Options,
  type Bm25Document,
  type Bm25Index,
  type Bm25Hit,
} from './bm25.js';

// ADR-121 Phase 21 — Content-addressed embed cache (BEYOND SOTA).
// In-memory LRU cache with sha256-keyed lookups. Composes with the
// lazy router by wrapping the embed adapter; production workloads
// with repeated queries see ~zero marginal cost on cache hits.
export {
  EmbedCache,
  wrapWithCache,
  canonicalizeText,
  type EmbedCacheOptions,
  type EmbedCacheStats,
} from './embed-cache.js';

// ADR-121 Phase 20 — Lazy/short-circuit adaptive router (BEYOND SOTA).
// Extends Phase 16's adaptive router with incremental feature
// extraction: embeds query → checks duplicate-density → if signal
// fires, skips variant+hypothetical embeds. Same routing decisions
// as Phase 16 with materially lower cost on workloads where easy
// signals fire early.
export {
  lazyAdaptiveRoute,
  type LazyEmbedAdapter,
  type LazyCandidateSource,
  type LazyRouterInputs,
  type LazyRouterCostReport,
  type LazyRouterResult,
} from './lazy-adaptive-router.js';

// ADR-121 Phase 16 — Adaptive primitive selection (BEYOND SOTA).
// Pure-function feature extractor + router that examines query/corpus
// shape and picks the right primitive automatically — saving the
// cost of run-everything-and-vote while preserving topology-winner
// behavior from Phase 14.
export {
  extractRetrievalFeatures,
  adaptiveRoute,
  type RetrievalFeatures,
  type AdaptiveRouterOptions,
  type AdaptivePrimitive,
  type AdaptiveDecision,
} from './adaptive-router.js';

// ADR-121 Phase 15 — Compound retrieval primitive (BEYOND SOTA).
// Composes HyDE (per-intent embedding fusion) + MMR (per-intent
// diversity) + RRF (across-intent rank fusion) into a single
// pipeline. Each component is well-known; the compound shape isn't
// shipped in any production library to my knowledge. Tested in CI
// against each individual primitive on real-embedding benchmarks.
export {
  compoundRetrieval,
  type CompoundIntent,
  type CompoundRetrievalOptions,
  type CompoundRetrievalResult,
  type CompoundIntentTrace,
} from './compound-retrieval.js';

// ADR-121 Phase 23 — Trend visualization + drift detection (BEYOND SOTA).
// Catches the "death by a thousand cuts" pattern where every commit
// drops 1% but cumulative drift is 30%. Renders sparklines for
// CI/PR dashboards.
export {
  renderSparkline,
  detectDrift,
  summarizeBenchmarkTrend,
  type DriftDetectionOptions,
  type DriftDetectionResult,
  type BenchmarkTrendSummary,
} from './ledger-trends.js';

// ADR-121 Phase 22 — Ledger analyzer + regression detection.
// Uses the Phase 18 chained ledger to detect performance regressions
// on every new benchmark run. The chain becomes a self-auditing
// performance history instead of just provenance.
export {
  getMetricAtPath,
  entriesForBenchmark,
  pickBaseline,
  checkRegression,
  checkRegressionBatch,
  type BaselineSelection,
  type RegressionCheckOptions,
  type RegressionCheckResult,
  type RegressionBatchInput,
  type RegressionBatchResult,
} from './ledger-analyzer.js';

// ADR-121 Phase 18 — Chained witness ledger.
// Builds a hash chain over Phase 15 witness manifests so the FULL
// HISTORY of benchmark runs becomes tamper-evident. Editing any
// historical entry breaks every subsequent signature. Anyone can
// replay the ledger and detect retroactive edits.
export {
  appendToLedger,
  verifyEntry,
  verifyLedger,
  generateLedgerKeypair,
  coSign,
  verifyCosignatureAgainst,
  type BenchmarkLedger,
  type LedgerEntry,
  type ChainVerifyResult,
  type CosignatureRecord,
} from './witness-ledger.js';

// ADR-121 Phase 15 — Benchmark witness manifest (ed25519-signed).
// Every benchmark run emits a tamper-evident JSON manifest with the
// corpus/query/model identity + results + signature. Anyone can
// verify the published numbers match the published code on the
// published commit. Zero new deps — uses node:crypto.
export {
  witness,
  verify,
  canonicalHash,
  corpusFingerprint,
  generateEphemeralKeypair,
  type BenchmarkWitnessInput,
  type WitnessedManifest,
} from './witness.js';

// ADR-121 Phase 15 — Synthetic topic-clustered corpus builder.
// Deterministic generator for benchmark + test corpora with known
// topic structure and relevance judgements. Used by the scale
// benchmark + available for users building their own benchmarks.
export {
  buildSyntheticTopicCorpus,
  type SyntheticCorpusOptions,
  type SyntheticCorpusEntry,
  type SyntheticCorpus,
} from './synthetic-corpus.js';

// ADR-121 Phase 13 — Standard IR evaluation metrics for benchmarking
// the RAG primitives. Pure functions: recall@k, precision@k, MRR,
// nDCG@k (binary + graded). Used by scripts/benchmark-rag-primitives.mjs
// to produce comparable numbers across all 5 search_text_* tools.
export {
  recallAtK,
  precisionAtK,
  reciprocalRank,
  meanReciprocalRank,
  dcgAtK,
  idcgAtK,
  ndcgAtK,
  meanMetric,
  compareRankings,
  type RelevanceSet,
  type GradedRelevance,
  type RankingComparison,
} from './ir-metrics.js';

export type { AutoEmbeddingConfig } from './embedding-service.js';

// RVF embedding service (pure-TS hash-based embeddings)
export { RvfEmbeddingService } from './rvf-embedding-service.js';

// RVF embedding cache (binary file persistence)
export {
  RvfEmbeddingCache,
  type RvfEmbeddingCacheConfig,
} from './rvf-embedding-cache.js';

// Chunking utilities
export {
  chunkText,
  estimateTokens,
  reconstructFromChunks,
  type ChunkingConfig,
  type Chunk,
  type ChunkedDocument,
} from './chunking.js';

// Normalization utilities
export {
  l2Normalize,
  l2NormalizeInPlace,
  l1Normalize,
  minMaxNormalize,
  zScoreNormalize,
  normalize,
  normalizeBatch,
  l2Norm,
  isNormalized,
  centerEmbeddings,
  type NormalizationOptions,
} from './normalization.js';

// Hyperbolic embeddings (Poincaré ball)
export {
  euclideanToPoincare,
  poincareToEuclidean,
  hyperbolicDistance,
  mobiusAdd,
  mobiusScalarMul,
  hyperbolicCentroid,
  batchEuclideanToPoincare,
  pairwiseHyperbolicDistances,
  isInPoincareBall,
  type HyperbolicConfig,
} from './hyperbolic.js';

// ADR-121 Phase 3b — async Poincaré ops backed by @ruvector/attention
// when installed; falls back to the hand-rolled hyperbolic.ts above.
// Same conceptual surface, but Float32Array-native and routed through
// Rust NAPI bindings for ~order-of-magnitude precision improvement
// (the hand-rolled path is approximate for expMap/logMap).
export {
  projectToPoincareBall as projectToPoincareBallAsync,
  poincareDistance as poincareDistanceAsync,
  expMap as expMapAsync,
  logMap as logMapAsync,
  mobiusAddition as mobiusAdditionAsync,
  hyperbolicAttentionAvailable,
  type HyperbolicAttentionOptions,
} from './hyperbolic-attention.js';

// Persistent cache
export {
  PersistentEmbeddingCache,
  isPersistentCacheAvailable,
  type PersistentCacheConfig as DiskCacheConfig,
  type PersistentCacheStats,
} from './persistent-cache.js';

// Neural substrate integration
export {
  NeuralEmbeddingService,
  createNeuralService,
  isNeuralAvailable,
  listEmbeddingModels,
  downloadEmbeddingModel,
  type DriftResult,
  type MemoryEntry,
  type AgentState,
  type CoherenceResult,
  type SubstrateHealth,
  type NeuralSubstrateConfig,
} from './neural-integration.js';

export type {
  EmbeddingProvider,
  EmbeddingConfig,
  OpenAIEmbeddingConfig,
  TransformersEmbeddingConfig,
  MockEmbeddingConfig,
  AgenticFlowEmbeddingConfig,
  RvfEmbeddingConfig,
  RuvectorOnnxEmbeddingConfig,
  EmbeddingResult,
  BatchEmbeddingResult,
  IEmbeddingService,
  SimilarityMetric,
  SimilarityResult,
  NormalizationType,
  PersistentCacheConfig,
} from './types.js';
