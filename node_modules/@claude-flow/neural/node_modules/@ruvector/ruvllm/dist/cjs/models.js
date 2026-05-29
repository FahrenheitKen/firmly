"use strict";
/**
 * RuvLTRA Model Registry and Downloader
 *
 * Automatically downloads GGUF models from HuggingFace Hub.
 *
 * @example
 * ```typescript
 * import { ModelDownloader, RUVLTRA_MODELS } from '@ruvector/ruvllm';
 *
 * // Download the Claude Code optimized model
 * const downloader = new ModelDownloader();
 * const modelPath = await downloader.download('claude-code');
 *
 * // Or download all models
 * await downloader.downloadAll();
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelDownloader = exports.MODEL_ALIASES = exports.RUVLTRA_MODELS = void 0;
exports.getDefaultModelsDir = getDefaultModelsDir;
exports.resolveModelId = resolveModelId;
exports.getModelInfo = getModelInfo;
exports.listModels = listModels;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
/** HuggingFace repository */
const HF_REPO = 'ruv/ruvltra';
const HF_BASE_URL = `https://huggingface.co/${HF_REPO}/resolve/main`;
/** Available RuvLTRA models */
exports.RUVLTRA_MODELS = {
    'claude-code': {
        id: 'claude-code',
        name: 'RuvLTRA Claude Code',
        filename: 'ruvltra-claude-code-0.5b-q4_k_m.gguf',
        sizeBytes: 398000000,
        size: '398 MB',
        parameters: '0.5B',
        useCase: 'Claude Code workflows, agentic coding',
        quantization: 'Q4_K_M',
        contextLength: 4096,
        url: `${HF_BASE_URL}/ruvltra-claude-code-0.5b-q4_k_m.gguf`,
    },
    'small': {
        id: 'small',
        name: 'RuvLTRA Small',
        filename: 'ruvltra-small-0.5b-q4_k_m.gguf',
        sizeBytes: 398000000,
        size: '398 MB',
        parameters: '0.5B',
        useCase: 'Edge devices, IoT, resource-constrained environments',
        quantization: 'Q4_K_M',
        contextLength: 4096,
        url: `${HF_BASE_URL}/ruvltra-small-0.5b-q4_k_m.gguf`,
    },
    'medium': {
        id: 'medium',
        name: 'RuvLTRA Medium',
        filename: 'ruvltra-medium-1.1b-q4_k_m.gguf',
        sizeBytes: 669000000,
        size: '669 MB',
        parameters: '1.1B',
        useCase: 'General purpose, balanced performance',
        quantization: 'Q4_K_M',
        contextLength: 8192,
        url: `${HF_BASE_URL}/ruvltra-medium-1.1b-q4_k_m.gguf`,
    },
};
/** Model aliases for convenience */
exports.MODEL_ALIASES = {
    'cc': 'claude-code',
    'claudecode': 'claude-code',
    'claude': 'claude-code',
    's': 'small',
    'sm': 'small',
    'm': 'medium',
    'med': 'medium',
    'default': 'claude-code',
};
/**
 * Get the default models directory
 */
function getDefaultModelsDir() {
    return (0, path_1.join)((0, os_1.homedir)(), '.ruvllm', 'models');
}
/**
 * Resolve model ID from alias or direct ID
 */
function resolveModelId(modelIdOrAlias) {
    const normalized = modelIdOrAlias.toLowerCase().trim();
    // Direct match
    if (exports.RUVLTRA_MODELS[normalized]) {
        return normalized;
    }
    // Alias match
    if (exports.MODEL_ALIASES[normalized]) {
        return exports.MODEL_ALIASES[normalized];
    }
    return null;
}
/**
 * Get model info by ID or alias
 */
function getModelInfo(modelIdOrAlias) {
    const id = resolveModelId(modelIdOrAlias);
    return id ? exports.RUVLTRA_MODELS[id] : null;
}
/**
 * List all available models
 */
function listModels() {
    return Object.values(exports.RUVLTRA_MODELS);
}
/**
 * Model downloader for RuvLTRA GGUF models
 */
class ModelDownloader {
    constructor(modelsDir) {
        this.modelsDir = modelsDir || getDefaultModelsDir();
    }
    /**
     * Get the path where a model would be saved
     */
    getModelPath(modelIdOrAlias) {
        const model = getModelInfo(modelIdOrAlias);
        if (!model)
            return null;
        return (0, path_1.join)(this.modelsDir, model.filename);
    }
    /**
     * Check if a model is already downloaded
     */
    isDownloaded(modelIdOrAlias) {
        const path = this.getModelPath(modelIdOrAlias);
        if (!path)
            return false;
        if (!(0, fs_1.existsSync)(path))
            return false;
        // Verify size matches expected
        const model = getModelInfo(modelIdOrAlias);
        if (!model)
            return false;
        const stats = (0, fs_1.statSync)(path);
        // Allow 5% variance for size check
        const minSize = model.sizeBytes * 0.95;
        return stats.size >= minSize;
    }
    /**
     * Get download status for all models
     */
    getStatus() {
        return listModels().map(model => ({
            model,
            downloaded: this.isDownloaded(model.id),
            path: this.getModelPath(model.id),
        }));
    }
    /**
     * Download a model from HuggingFace
     */
    async download(modelIdOrAlias, options = {}) {
        const model = getModelInfo(modelIdOrAlias);
        if (!model) {
            const available = listModels().map(m => m.id).join(', ');
            throw new Error(`Unknown model: ${modelIdOrAlias}. Available models: ${available}`);
        }
        const destDir = options.modelsDir || this.modelsDir;
        const destPath = (0, path_1.join)(destDir, model.filename);
        // Check if already downloaded
        if (!options.force && this.isDownloaded(model.id)) {
            return destPath;
        }
        // Ensure directory exists
        if (!(0, fs_1.existsSync)(destDir)) {
            (0, fs_1.mkdirSync)(destDir, { recursive: true });
        }
        // Download with progress tracking
        const tempPath = `${destPath}.tmp`;
        let startTime = Date.now();
        let lastProgressTime = startTime;
        let lastDownloaded = 0;
        try {
            // Use dynamic import for node-fetch if native fetch not available
            const fetchFn = globalThis.fetch || (await Promise.resolve().then(() => __importStar(require('node:https')))).default;
            const response = await fetch(model.url, {
                headers: {
                    'User-Agent': 'RuvLLM/2.3.0',
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const contentLength = parseInt(response.headers.get('content-length') || String(model.sizeBytes));
            // Create write stream
            const fileStream = (0, fs_1.createWriteStream)(tempPath);
            let downloaded = 0;
            // Stream with progress
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Response body is not readable');
            }
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                downloaded += value.length;
                fileStream.write(value);
                // Report progress
                if (options.onProgress) {
                    const now = Date.now();
                    const elapsed = (now - lastProgressTime) / 1000;
                    const bytesThisInterval = downloaded - lastDownloaded;
                    const speedBps = elapsed > 0 ? bytesThisInterval / elapsed : 0;
                    const remaining = contentLength - downloaded;
                    const etaSeconds = speedBps > 0 ? remaining / speedBps : 0;
                    options.onProgress({
                        modelId: model.id,
                        downloaded,
                        total: contentLength,
                        percent: Math.round((downloaded / contentLength) * 100),
                        speedBps,
                        etaSeconds,
                    });
                    lastProgressTime = now;
                    lastDownloaded = downloaded;
                }
            }
            fileStream.end();
            // Wait for file to be fully written
            await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });
            // Move temp file to final destination
            if ((0, fs_1.existsSync)(destPath)) {
                (0, fs_1.unlinkSync)(destPath);
            }
            (0, fs_1.renameSync)(tempPath, destPath);
            return destPath;
        }
        catch (error) {
            // Clean up temp file on error
            if ((0, fs_1.existsSync)(tempPath)) {
                try {
                    (0, fs_1.unlinkSync)(tempPath);
                }
                catch { }
            }
            throw error;
        }
    }
    /**
     * Download all available models
     */
    async downloadAll(options = {}) {
        const paths = [];
        for (const model of listModels()) {
            const path = await this.download(model.id, options);
            paths.push(path);
        }
        return paths;
    }
    /**
     * Delete a downloaded model
     */
    delete(modelIdOrAlias) {
        const path = this.getModelPath(modelIdOrAlias);
        if (!path || !(0, fs_1.existsSync)(path)) {
            return false;
        }
        (0, fs_1.unlinkSync)(path);
        return true;
    }
    /**
     * Delete all downloaded models
     */
    deleteAll() {
        let count = 0;
        for (const model of listModels()) {
            if (this.delete(model.id)) {
                count++;
            }
        }
        return count;
    }
}
exports.ModelDownloader = ModelDownloader;
exports.default = ModelDownloader;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vZGVscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7R0FnQkc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTBISCxrREFFQztBQUtELHdDQWNDO0FBS0Qsb0NBR0M7QUFLRCxnQ0FFQztBQTVKRCwyQkFBZ0c7QUFDaEcsK0JBQXFDO0FBQ3JDLDJCQUE2QjtBQTJEN0IsNkJBQTZCO0FBQzdCLE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQztBQUM5QixNQUFNLFdBQVcsR0FBRywwQkFBMEIsT0FBTyxlQUFlLENBQUM7QUFFckUsK0JBQStCO0FBQ2xCLFFBQUEsY0FBYyxHQUE4QjtJQUN2RCxhQUFhLEVBQUU7UUFDYixFQUFFLEVBQUUsYUFBYTtRQUNqQixJQUFJLEVBQUUscUJBQXFCO1FBQzNCLFFBQVEsRUFBRSxzQ0FBc0M7UUFDaEQsU0FBUyxFQUFFLFNBQVc7UUFDdEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxVQUFVLEVBQUUsTUFBTTtRQUNsQixPQUFPLEVBQUUsdUNBQXVDO1FBQ2hELFlBQVksRUFBRSxRQUFRO1FBQ3RCLGFBQWEsRUFBRSxJQUFJO1FBQ25CLEdBQUcsRUFBRSxHQUFHLFdBQVcsdUNBQXVDO0tBQzNEO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsRUFBRSxFQUFFLE9BQU87UUFDWCxJQUFJLEVBQUUsZUFBZTtRQUNyQixRQUFRLEVBQUUsZ0NBQWdDO1FBQzFDLFNBQVMsRUFBRSxTQUFXO1FBQ3RCLElBQUksRUFBRSxRQUFRO1FBQ2QsVUFBVSxFQUFFLE1BQU07UUFDbEIsT0FBTyxFQUFFLHNEQUFzRDtRQUMvRCxZQUFZLEVBQUUsUUFBUTtRQUN0QixhQUFhLEVBQUUsSUFBSTtRQUNuQixHQUFHLEVBQUUsR0FBRyxXQUFXLGlDQUFpQztLQUNyRDtJQUNELFFBQVEsRUFBRTtRQUNSLEVBQUUsRUFBRSxRQUFRO1FBQ1osSUFBSSxFQUFFLGdCQUFnQjtRQUN0QixRQUFRLEVBQUUsaUNBQWlDO1FBQzNDLFNBQVMsRUFBRSxTQUFXO1FBQ3RCLElBQUksRUFBRSxRQUFRO1FBQ2QsVUFBVSxFQUFFLE1BQU07UUFDbEIsT0FBTyxFQUFFLHVDQUF1QztRQUNoRCxZQUFZLEVBQUUsUUFBUTtRQUN0QixhQUFhLEVBQUUsSUFBSTtRQUNuQixHQUFHLEVBQUUsR0FBRyxXQUFXLGtDQUFrQztLQUN0RDtDQUNGLENBQUM7QUFFRixvQ0FBb0M7QUFDdkIsUUFBQSxhQUFhLEdBQTJCO0lBQ25ELElBQUksRUFBRSxhQUFhO0lBQ25CLFlBQVksRUFBRSxhQUFhO0lBQzNCLFFBQVEsRUFBRSxhQUFhO0lBQ3ZCLEdBQUcsRUFBRSxPQUFPO0lBQ1osSUFBSSxFQUFFLE9BQU87SUFDYixHQUFHLEVBQUUsUUFBUTtJQUNiLEtBQUssRUFBRSxRQUFRO0lBQ2YsU0FBUyxFQUFFLGFBQWE7Q0FDekIsQ0FBQztBQUVGOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CO0lBQ2pDLE9BQU8sSUFBQSxXQUFJLEVBQUMsSUFBQSxZQUFPLEdBQUUsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsY0FBYyxDQUFDLGNBQXNCO0lBQ25ELE1BQU0sVUFBVSxHQUFHLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUV2RCxlQUFlO0lBQ2YsSUFBSSxzQkFBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDL0IsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVELGNBQWM7SUFDZCxJQUFJLHFCQUFhLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUM5QixPQUFPLHFCQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsWUFBWSxDQUFDLGNBQXNCO0lBQ2pELE1BQU0sRUFBRSxHQUFHLGNBQWMsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUMxQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsc0JBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ3hDLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLFVBQVU7SUFDeEIsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLHNCQUFjLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLGVBQWU7SUFHMUIsWUFBWSxTQUFrQjtRQUM1QixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO0lBQ3RELENBQUM7SUFFRDs7T0FFRztJQUNILFlBQVksQ0FBQyxjQUFzQjtRQUNqQyxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLElBQUksQ0FBQztRQUN4QixPQUFPLElBQUEsV0FBSSxFQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRDs7T0FFRztJQUNILFlBQVksQ0FBQyxjQUFzQjtRQUNqQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFFeEIsSUFBSSxDQUFDLElBQUEsZUFBVSxFQUFDLElBQUksQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBRXBDLCtCQUErQjtRQUMvQixNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUV6QixNQUFNLEtBQUssR0FBRyxJQUFBLGFBQVEsRUFBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixtQ0FBbUM7UUFDbkMsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDdkMsT0FBTyxLQUFLLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQztJQUMvQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTO1FBQ1AsT0FBTyxVQUFVLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2hDLEtBQUs7WUFDTCxVQUFVLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUU7U0FDbkMsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsUUFBUSxDQUNaLGNBQXNCLEVBQ3RCLFVBQTJCLEVBQUU7UUFFN0IsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLE1BQU0sU0FBUyxHQUFHLFVBQVUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDekQsTUFBTSxJQUFJLEtBQUssQ0FDYixrQkFBa0IsY0FBYyx1QkFBdUIsU0FBUyxFQUFFLENBQ25FLENBQUM7UUFDSixDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3BELE1BQU0sUUFBUSxHQUFHLElBQUEsV0FBSSxFQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFL0MsOEJBQThCO1FBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDbEQsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUVELDBCQUEwQjtRQUMxQixJQUFJLENBQUMsSUFBQSxlQUFVLEVBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUN6QixJQUFBLGNBQVMsRUFBQyxPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRUQsa0NBQWtDO1FBQ2xDLE1BQU0sUUFBUSxHQUFHLEdBQUcsUUFBUSxNQUFNLENBQUM7UUFDbkMsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzNCLElBQUksZ0JBQWdCLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztRQUV2QixJQUFJLENBQUM7WUFDSCxrRUFBa0U7WUFDbEUsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLEtBQUssSUFBSSxDQUFDLHdEQUFhLFlBQVksR0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1lBRXpFLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUU7Z0JBQ3RDLE9BQU8sRUFBRTtvQkFDUCxZQUFZLEVBQUUsY0FBYztpQkFDN0I7YUFDRixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLFFBQVEsUUFBUSxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztZQUNyRSxDQUFDO1lBRUQsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUM1QixRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQ2xFLENBQUM7WUFFRixzQkFBc0I7WUFDdEIsTUFBTSxVQUFVLEdBQUcsSUFBQSxzQkFBaUIsRUFBQyxRQUFRLENBQUMsQ0FBQztZQUMvQyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7WUFFbkIsdUJBQXVCO1lBQ3ZCLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUM7WUFDMUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQztZQUNuRCxDQUFDO1lBRUQsT0FBTyxJQUFJLEVBQUUsQ0FBQztnQkFDWixNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUM1QyxJQUFJLElBQUk7b0JBQUUsTUFBTTtnQkFFaEIsVUFBVSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUM7Z0JBQzNCLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBRXhCLGtCQUFrQjtnQkFDbEIsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ3ZCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxHQUFHLEdBQUcsZ0JBQWdCLENBQUMsR0FBRyxJQUFJLENBQUM7b0JBQ2hELE1BQU0saUJBQWlCLEdBQUcsVUFBVSxHQUFHLGNBQWMsQ0FBQztvQkFDdEQsTUFBTSxRQUFRLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQy9ELE1BQU0sU0FBUyxHQUFHLGFBQWEsR0FBRyxVQUFVLENBQUM7b0JBQzdDLE1BQU0sVUFBVSxHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFFM0QsT0FBTyxDQUFDLFVBQVUsQ0FBQzt3QkFDakIsT0FBTyxFQUFFLEtBQUssQ0FBQyxFQUFFO3dCQUNqQixVQUFVO3dCQUNWLEtBQUssRUFBRSxhQUFhO3dCQUNwQixPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsR0FBRyxhQUFhLENBQUMsR0FBRyxHQUFHLENBQUM7d0JBQ3ZELFFBQVE7d0JBQ1IsVUFBVTtxQkFDWCxDQUFDLENBQUM7b0JBRUgsZ0JBQWdCLEdBQUcsR0FBRyxDQUFDO29CQUN2QixjQUFjLEdBQUcsVUFBVSxDQUFDO2dCQUM5QixDQUFDO1lBQ0gsQ0FBQztZQUVELFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUVqQixvQ0FBb0M7WUFDcEMsTUFBTSxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtnQkFDMUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2pDLFVBQVUsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ2pDLENBQUMsQ0FBQyxDQUFDO1lBRUgsc0NBQXNDO1lBQ3RDLElBQUksSUFBQSxlQUFVLEVBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDekIsSUFBQSxlQUFVLEVBQUMsUUFBUSxDQUFDLENBQUM7WUFDdkIsQ0FBQztZQUNELElBQUEsZUFBVSxFQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUUvQixPQUFPLFFBQVEsQ0FBQztRQUNsQixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLDhCQUE4QjtZQUM5QixJQUFJLElBQUEsZUFBVSxFQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pCLElBQUksQ0FBQztvQkFBQyxJQUFBLGVBQVUsRUFBQyxRQUFRLENBQUMsQ0FBQztnQkFBQyxDQUFDO2dCQUFDLE1BQU0sQ0FBQyxDQUFBLENBQUM7WUFDeEMsQ0FBQztZQUNELE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBMkIsRUFBRTtRQUM3QyxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7UUFDM0IsS0FBSyxNQUFNLEtBQUssSUFBSSxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ2pDLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3BELEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkIsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLGNBQXNCO1FBQzNCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUEsZUFBVSxFQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDL0IsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBQ0QsSUFBQSxlQUFVLEVBQUMsSUFBSSxDQUFDLENBQUM7UUFDakIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTO1FBQ1AsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ2QsS0FBSyxNQUFNLEtBQUssSUFBSSxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ2pDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDMUIsS0FBSyxFQUFFLENBQUM7WUFDVixDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBdE1ELDBDQXNNQztBQUVELGtCQUFlLGVBQWUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUnV2TFRSQSBNb2RlbCBSZWdpc3RyeSBhbmQgRG93bmxvYWRlclxuICpcbiAqIEF1dG9tYXRpY2FsbHkgZG93bmxvYWRzIEdHVUYgbW9kZWxzIGZyb20gSHVnZ2luZ0ZhY2UgSHViLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBNb2RlbERvd25sb2FkZXIsIFJVVkxUUkFfTU9ERUxTIH0gZnJvbSAnQHJ1dmVjdG9yL3J1dmxsbSc7XG4gKlxuICogLy8gRG93bmxvYWQgdGhlIENsYXVkZSBDb2RlIG9wdGltaXplZCBtb2RlbFxuICogY29uc3QgZG93bmxvYWRlciA9IG5ldyBNb2RlbERvd25sb2FkZXIoKTtcbiAqIGNvbnN0IG1vZGVsUGF0aCA9IGF3YWl0IGRvd25sb2FkZXIuZG93bmxvYWQoJ2NsYXVkZS1jb2RlJyk7XG4gKlxuICogLy8gT3IgZG93bmxvYWQgYWxsIG1vZGVsc1xuICogYXdhaXQgZG93bmxvYWRlci5kb3dubG9hZEFsbCgpO1xuICogYGBgXG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlV3JpdGVTdHJlYW0sIGV4aXN0c1N5bmMsIG1rZGlyU3luYywgc3RhdFN5bmMsIHVubGlua1N5bmMsIHJlbmFtZVN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBqb2luLCBkaXJuYW1lIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBob21lZGlyIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgcGlwZWxpbmUgfSBmcm9tICdzdHJlYW0vcHJvbWlzZXMnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5cbi8qKiBNb2RlbCBpbmZvcm1hdGlvbiBmcm9tIEh1Z2dpbmdGYWNlICovXG5leHBvcnQgaW50ZXJmYWNlIE1vZGVsSW5mbyB7XG4gIC8qKiBNb2RlbCBpZGVudGlmaWVyICovXG4gIGlkOiBzdHJpbmc7XG4gIC8qKiBEaXNwbGF5IG5hbWUgKi9cbiAgbmFtZTogc3RyaW5nO1xuICAvKiogTW9kZWwgZmlsZW5hbWUgb24gSHVnZ2luZ0ZhY2UgKi9cbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgLyoqIE1vZGVsIHNpemUgaW4gYnl0ZXMgKi9cbiAgc2l6ZUJ5dGVzOiBudW1iZXI7XG4gIC8qKiBNb2RlbCBzaXplIChodW1hbiByZWFkYWJsZSkgKi9cbiAgc2l6ZTogc3RyaW5nO1xuICAvKiogUGFyYW1ldGVyIGNvdW50ICovXG4gIHBhcmFtZXRlcnM6IHN0cmluZztcbiAgLyoqIFVzZSBjYXNlIGRlc2NyaXB0aW9uICovXG4gIHVzZUNhc2U6IHN0cmluZztcbiAgLyoqIFF1YW50aXphdGlvbiB0eXBlICovXG4gIHF1YW50aXphdGlvbjogc3RyaW5nO1xuICAvKiogQ29udGV4dCB3aW5kb3cgc2l6ZSAqL1xuICBjb250ZXh0TGVuZ3RoOiBudW1iZXI7XG4gIC8qKiBIdWdnaW5nRmFjZSBkb3dubG9hZCBVUkwgKi9cbiAgdXJsOiBzdHJpbmc7XG59XG5cbi8qKiBEb3dubG9hZCBwcm9ncmVzcyBjYWxsYmFjayAqL1xuZXhwb3J0IHR5cGUgUHJvZ3Jlc3NDYWxsYmFjayA9IChwcm9ncmVzczogRG93bmxvYWRQcm9ncmVzcykgPT4gdm9pZDtcblxuLyoqIERvd25sb2FkIHByb2dyZXNzIGluZm9ybWF0aW9uICovXG5leHBvcnQgaW50ZXJmYWNlIERvd25sb2FkUHJvZ3Jlc3Mge1xuICAvKiogTW9kZWwgYmVpbmcgZG93bmxvYWRlZCAqL1xuICBtb2RlbElkOiBzdHJpbmc7XG4gIC8qKiBCeXRlcyBkb3dubG9hZGVkIHNvIGZhciAqL1xuICBkb3dubG9hZGVkOiBudW1iZXI7XG4gIC8qKiBUb3RhbCBieXRlcyB0byBkb3dubG9hZCAqL1xuICB0b3RhbDogbnVtYmVyO1xuICAvKiogRG93bmxvYWQgcGVyY2VudGFnZSAoMC0xMDApICovXG4gIHBlcmNlbnQ6IG51bWJlcjtcbiAgLyoqIERvd25sb2FkIHNwZWVkIGluIGJ5dGVzIHBlciBzZWNvbmQgKi9cbiAgc3BlZWRCcHM6IG51bWJlcjtcbiAgLyoqIEVzdGltYXRlZCB0aW1lIHJlbWFpbmluZyBpbiBzZWNvbmRzICovXG4gIGV0YVNlY29uZHM6IG51bWJlcjtcbn1cblxuLyoqIERvd25sb2FkIG9wdGlvbnMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgRG93bmxvYWRPcHRpb25zIHtcbiAgLyoqIERpcmVjdG9yeSB0byBzYXZlIG1vZGVscyAoZGVmYXVsdDogfi8ucnV2bGxtL21vZGVscykgKi9cbiAgbW9kZWxzRGlyPzogc3RyaW5nO1xuICAvKiogRm9yY2UgcmUtZG93bmxvYWQgZXZlbiBpZiBmaWxlIGV4aXN0cyAqL1xuICBmb3JjZT86IGJvb2xlYW47XG4gIC8qKiBQcm9ncmVzcyBjYWxsYmFjayAqL1xuICBvblByb2dyZXNzPzogUHJvZ3Jlc3NDYWxsYmFjaztcbiAgLyoqIFZlcmlmeSBmaWxlIGludGVncml0eSBhZnRlciBkb3dubG9hZCAqL1xuICB2ZXJpZnk/OiBib29sZWFuO1xufVxuXG4vKiogSHVnZ2luZ0ZhY2UgcmVwb3NpdG9yeSAqL1xuY29uc3QgSEZfUkVQTyA9ICdydXYvcnV2bHRyYSc7XG5jb25zdCBIRl9CQVNFX1VSTCA9IGBodHRwczovL2h1Z2dpbmdmYWNlLmNvLyR7SEZfUkVQT30vcmVzb2x2ZS9tYWluYDtcblxuLyoqIEF2YWlsYWJsZSBSdXZMVFJBIG1vZGVscyAqL1xuZXhwb3J0IGNvbnN0IFJVVkxUUkFfTU9ERUxTOiBSZWNvcmQ8c3RyaW5nLCBNb2RlbEluZm8+ID0ge1xuICAnY2xhdWRlLWNvZGUnOiB7XG4gICAgaWQ6ICdjbGF1ZGUtY29kZScsXG4gICAgbmFtZTogJ1J1dkxUUkEgQ2xhdWRlIENvZGUnLFxuICAgIGZpbGVuYW1lOiAncnV2bHRyYS1jbGF1ZGUtY29kZS0wLjViLXE0X2tfbS5nZ3VmJyxcbiAgICBzaXplQnl0ZXM6IDM5OF8wMDBfMDAwLFxuICAgIHNpemU6ICczOTggTUInLFxuICAgIHBhcmFtZXRlcnM6ICcwLjVCJyxcbiAgICB1c2VDYXNlOiAnQ2xhdWRlIENvZGUgd29ya2Zsb3dzLCBhZ2VudGljIGNvZGluZycsXG4gICAgcXVhbnRpemF0aW9uOiAnUTRfS19NJyxcbiAgICBjb250ZXh0TGVuZ3RoOiA0MDk2LFxuICAgIHVybDogYCR7SEZfQkFTRV9VUkx9L3J1dmx0cmEtY2xhdWRlLWNvZGUtMC41Yi1xNF9rX20uZ2d1ZmAsXG4gIH0sXG4gICdzbWFsbCc6IHtcbiAgICBpZDogJ3NtYWxsJyxcbiAgICBuYW1lOiAnUnV2TFRSQSBTbWFsbCcsXG4gICAgZmlsZW5hbWU6ICdydXZsdHJhLXNtYWxsLTAuNWItcTRfa19tLmdndWYnLFxuICAgIHNpemVCeXRlczogMzk4XzAwMF8wMDAsXG4gICAgc2l6ZTogJzM5OCBNQicsXG4gICAgcGFyYW1ldGVyczogJzAuNUInLFxuICAgIHVzZUNhc2U6ICdFZGdlIGRldmljZXMsIElvVCwgcmVzb3VyY2UtY29uc3RyYWluZWQgZW52aXJvbm1lbnRzJyxcbiAgICBxdWFudGl6YXRpb246ICdRNF9LX00nLFxuICAgIGNvbnRleHRMZW5ndGg6IDQwOTYsXG4gICAgdXJsOiBgJHtIRl9CQVNFX1VSTH0vcnV2bHRyYS1zbWFsbC0wLjViLXE0X2tfbS5nZ3VmYCxcbiAgfSxcbiAgJ21lZGl1bSc6IHtcbiAgICBpZDogJ21lZGl1bScsXG4gICAgbmFtZTogJ1J1dkxUUkEgTWVkaXVtJyxcbiAgICBmaWxlbmFtZTogJ3J1dmx0cmEtbWVkaXVtLTEuMWItcTRfa19tLmdndWYnLFxuICAgIHNpemVCeXRlczogNjY5XzAwMF8wMDAsXG4gICAgc2l6ZTogJzY2OSBNQicsXG4gICAgcGFyYW1ldGVyczogJzEuMUInLFxuICAgIHVzZUNhc2U6ICdHZW5lcmFsIHB1cnBvc2UsIGJhbGFuY2VkIHBlcmZvcm1hbmNlJyxcbiAgICBxdWFudGl6YXRpb246ICdRNF9LX00nLFxuICAgIGNvbnRleHRMZW5ndGg6IDgxOTIsXG4gICAgdXJsOiBgJHtIRl9CQVNFX1VSTH0vcnV2bHRyYS1tZWRpdW0tMS4xYi1xNF9rX20uZ2d1ZmAsXG4gIH0sXG59O1xuXG4vKiogTW9kZWwgYWxpYXNlcyBmb3IgY29udmVuaWVuY2UgKi9cbmV4cG9ydCBjb25zdCBNT0RFTF9BTElBU0VTOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAnY2MnOiAnY2xhdWRlLWNvZGUnLFxuICAnY2xhdWRlY29kZSc6ICdjbGF1ZGUtY29kZScsXG4gICdjbGF1ZGUnOiAnY2xhdWRlLWNvZGUnLFxuICAncyc6ICdzbWFsbCcsXG4gICdzbSc6ICdzbWFsbCcsXG4gICdtJzogJ21lZGl1bScsXG4gICdtZWQnOiAnbWVkaXVtJyxcbiAgJ2RlZmF1bHQnOiAnY2xhdWRlLWNvZGUnLFxufTtcblxuLyoqXG4gKiBHZXQgdGhlIGRlZmF1bHQgbW9kZWxzIGRpcmVjdG9yeVxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVmYXVsdE1vZGVsc0RpcigpOiBzdHJpbmcge1xuICByZXR1cm4gam9pbihob21lZGlyKCksICcucnV2bGxtJywgJ21vZGVscycpO1xufVxuXG4vKipcbiAqIFJlc29sdmUgbW9kZWwgSUQgZnJvbSBhbGlhcyBvciBkaXJlY3QgSURcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVNb2RlbElkKG1vZGVsSWRPckFsaWFzOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3Qgbm9ybWFsaXplZCA9IG1vZGVsSWRPckFsaWFzLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuXG4gIC8vIERpcmVjdCBtYXRjaFxuICBpZiAoUlVWTFRSQV9NT0RFTFNbbm9ybWFsaXplZF0pIHtcbiAgICByZXR1cm4gbm9ybWFsaXplZDtcbiAgfVxuXG4gIC8vIEFsaWFzIG1hdGNoXG4gIGlmIChNT0RFTF9BTElBU0VTW25vcm1hbGl6ZWRdKSB7XG4gICAgcmV0dXJuIE1PREVMX0FMSUFTRVNbbm9ybWFsaXplZF07XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBHZXQgbW9kZWwgaW5mbyBieSBJRCBvciBhbGlhc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TW9kZWxJbmZvKG1vZGVsSWRPckFsaWFzOiBzdHJpbmcpOiBNb2RlbEluZm8gfCBudWxsIHtcbiAgY29uc3QgaWQgPSByZXNvbHZlTW9kZWxJZChtb2RlbElkT3JBbGlhcyk7XG4gIHJldHVybiBpZCA/IFJVVkxUUkFfTU9ERUxTW2lkXSA6IG51bGw7XG59XG5cbi8qKlxuICogTGlzdCBhbGwgYXZhaWxhYmxlIG1vZGVsc1xuICovXG5leHBvcnQgZnVuY3Rpb24gbGlzdE1vZGVscygpOiBNb2RlbEluZm9bXSB7XG4gIHJldHVybiBPYmplY3QudmFsdWVzKFJVVkxUUkFfTU9ERUxTKTtcbn1cblxuLyoqXG4gKiBNb2RlbCBkb3dubG9hZGVyIGZvciBSdXZMVFJBIEdHVUYgbW9kZWxzXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2RlbERvd25sb2FkZXIge1xuICBwcml2YXRlIG1vZGVsc0Rpcjogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKG1vZGVsc0Rpcj86IHN0cmluZykge1xuICAgIHRoaXMubW9kZWxzRGlyID0gbW9kZWxzRGlyIHx8IGdldERlZmF1bHRNb2RlbHNEaXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHBhdGggd2hlcmUgYSBtb2RlbCB3b3VsZCBiZSBzYXZlZFxuICAgKi9cbiAgZ2V0TW9kZWxQYXRoKG1vZGVsSWRPckFsaWFzOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBtb2RlbCA9IGdldE1vZGVsSW5mbyhtb2RlbElkT3JBbGlhcyk7XG4gICAgaWYgKCFtb2RlbCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIGpvaW4odGhpcy5tb2RlbHNEaXIsIG1vZGVsLmZpbGVuYW1lKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhIG1vZGVsIGlzIGFscmVhZHkgZG93bmxvYWRlZFxuICAgKi9cbiAgaXNEb3dubG9hZGVkKG1vZGVsSWRPckFsaWFzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5nZXRNb2RlbFBhdGgobW9kZWxJZE9yQWxpYXMpO1xuICAgIGlmICghcGF0aCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgaWYgKCFleGlzdHNTeW5jKHBhdGgpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBWZXJpZnkgc2l6ZSBtYXRjaGVzIGV4cGVjdGVkXG4gICAgY29uc3QgbW9kZWwgPSBnZXRNb2RlbEluZm8obW9kZWxJZE9yQWxpYXMpO1xuICAgIGlmICghbW9kZWwpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHN0YXRzID0gc3RhdFN5bmMocGF0aCk7XG4gICAgLy8gQWxsb3cgNSUgdmFyaWFuY2UgZm9yIHNpemUgY2hlY2tcbiAgICBjb25zdCBtaW5TaXplID0gbW9kZWwuc2l6ZUJ5dGVzICogMC45NTtcbiAgICByZXR1cm4gc3RhdHMuc2l6ZSA+PSBtaW5TaXplO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBkb3dubG9hZCBzdGF0dXMgZm9yIGFsbCBtb2RlbHNcbiAgICovXG4gIGdldFN0YXR1cygpOiB7IG1vZGVsOiBNb2RlbEluZm87IGRvd25sb2FkZWQ6IGJvb2xlYW47IHBhdGg6IHN0cmluZyB9W10ge1xuICAgIHJldHVybiBsaXN0TW9kZWxzKCkubWFwKG1vZGVsID0+ICh7XG4gICAgICBtb2RlbCxcbiAgICAgIGRvd25sb2FkZWQ6IHRoaXMuaXNEb3dubG9hZGVkKG1vZGVsLmlkKSxcbiAgICAgIHBhdGg6IHRoaXMuZ2V0TW9kZWxQYXRoKG1vZGVsLmlkKSEsXG4gICAgfSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIERvd25sb2FkIGEgbW9kZWwgZnJvbSBIdWdnaW5nRmFjZVxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWQoXG4gICAgbW9kZWxJZE9yQWxpYXM6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEb3dubG9hZE9wdGlvbnMgPSB7fVxuICApOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IG1vZGVsID0gZ2V0TW9kZWxJbmZvKG1vZGVsSWRPckFsaWFzKTtcbiAgICBpZiAoIW1vZGVsKSB7XG4gICAgICBjb25zdCBhdmFpbGFibGUgPSBsaXN0TW9kZWxzKCkubWFwKG0gPT4gbS5pZCkuam9pbignLCAnKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFVua25vd24gbW9kZWw6ICR7bW9kZWxJZE9yQWxpYXN9LiBBdmFpbGFibGUgbW9kZWxzOiAke2F2YWlsYWJsZX1gXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGRlc3REaXIgPSBvcHRpb25zLm1vZGVsc0RpciB8fCB0aGlzLm1vZGVsc0RpcjtcbiAgICBjb25zdCBkZXN0UGF0aCA9IGpvaW4oZGVzdERpciwgbW9kZWwuZmlsZW5hbWUpO1xuXG4gICAgLy8gQ2hlY2sgaWYgYWxyZWFkeSBkb3dubG9hZGVkXG4gICAgaWYgKCFvcHRpb25zLmZvcmNlICYmIHRoaXMuaXNEb3dubG9hZGVkKG1vZGVsLmlkKSkge1xuICAgICAgcmV0dXJuIGRlc3RQYXRoO1xuICAgIH1cblxuICAgIC8vIEVuc3VyZSBkaXJlY3RvcnkgZXhpc3RzXG4gICAgaWYgKCFleGlzdHNTeW5jKGRlc3REaXIpKSB7XG4gICAgICBta2RpclN5bmMoZGVzdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgfVxuXG4gICAgLy8gRG93bmxvYWQgd2l0aCBwcm9ncmVzcyB0cmFja2luZ1xuICAgIGNvbnN0IHRlbXBQYXRoID0gYCR7ZGVzdFBhdGh9LnRtcGA7XG4gICAgbGV0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgbGV0IGxhc3RQcm9ncmVzc1RpbWUgPSBzdGFydFRpbWU7XG4gICAgbGV0IGxhc3REb3dubG9hZGVkID0gMDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBVc2UgZHluYW1pYyBpbXBvcnQgZm9yIG5vZGUtZmV0Y2ggaWYgbmF0aXZlIGZldGNoIG5vdCBhdmFpbGFibGVcbiAgICAgIGNvbnN0IGZldGNoRm4gPSBnbG9iYWxUaGlzLmZldGNoIHx8IChhd2FpdCBpbXBvcnQoJ25vZGU6aHR0cHMnKSkuZGVmYXVsdDtcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChtb2RlbC51cmwsIHtcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdVc2VyLUFnZW50JzogJ1J1dkxMTS8yLjMuMCcsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9OiAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGNvbnRlbnRMZW5ndGggPSBwYXJzZUludChcbiAgICAgICAgcmVzcG9uc2UuaGVhZGVycy5nZXQoJ2NvbnRlbnQtbGVuZ3RoJykgfHwgU3RyaW5nKG1vZGVsLnNpemVCeXRlcylcbiAgICAgICk7XG5cbiAgICAgIC8vIENyZWF0ZSB3cml0ZSBzdHJlYW1cbiAgICAgIGNvbnN0IGZpbGVTdHJlYW0gPSBjcmVhdGVXcml0ZVN0cmVhbSh0ZW1wUGF0aCk7XG4gICAgICBsZXQgZG93bmxvYWRlZCA9IDA7XG5cbiAgICAgIC8vIFN0cmVhbSB3aXRoIHByb2dyZXNzXG4gICAgICBjb25zdCByZWFkZXIgPSByZXNwb25zZS5ib2R5Py5nZXRSZWFkZXIoKTtcbiAgICAgIGlmICghcmVhZGVyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmVzcG9uc2UgYm9keSBpcyBub3QgcmVhZGFibGUnKTtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgeyBkb25lLCB2YWx1ZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgICAgaWYgKGRvbmUpIGJyZWFrO1xuXG4gICAgICAgIGRvd25sb2FkZWQgKz0gdmFsdWUubGVuZ3RoO1xuICAgICAgICBmaWxlU3RyZWFtLndyaXRlKHZhbHVlKTtcblxuICAgICAgICAvLyBSZXBvcnQgcHJvZ3Jlc3NcbiAgICAgICAgaWYgKG9wdGlvbnMub25Qcm9ncmVzcykge1xuICAgICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgICAgY29uc3QgZWxhcHNlZCA9IChub3cgLSBsYXN0UHJvZ3Jlc3NUaW1lKSAvIDEwMDA7XG4gICAgICAgICAgY29uc3QgYnl0ZXNUaGlzSW50ZXJ2YWwgPSBkb3dubG9hZGVkIC0gbGFzdERvd25sb2FkZWQ7XG4gICAgICAgICAgY29uc3Qgc3BlZWRCcHMgPSBlbGFwc2VkID4gMCA/IGJ5dGVzVGhpc0ludGVydmFsIC8gZWxhcHNlZCA6IDA7XG4gICAgICAgICAgY29uc3QgcmVtYWluaW5nID0gY29udGVudExlbmd0aCAtIGRvd25sb2FkZWQ7XG4gICAgICAgICAgY29uc3QgZXRhU2Vjb25kcyA9IHNwZWVkQnBzID4gMCA/IHJlbWFpbmluZyAvIHNwZWVkQnBzIDogMDtcblxuICAgICAgICAgIG9wdGlvbnMub25Qcm9ncmVzcyh7XG4gICAgICAgICAgICBtb2RlbElkOiBtb2RlbC5pZCxcbiAgICAgICAgICAgIGRvd25sb2FkZWQsXG4gICAgICAgICAgICB0b3RhbDogY29udGVudExlbmd0aCxcbiAgICAgICAgICAgIHBlcmNlbnQ6IE1hdGgucm91bmQoKGRvd25sb2FkZWQgLyBjb250ZW50TGVuZ3RoKSAqIDEwMCksXG4gICAgICAgICAgICBzcGVlZEJwcyxcbiAgICAgICAgICAgIGV0YVNlY29uZHMsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBsYXN0UHJvZ3Jlc3NUaW1lID0gbm93O1xuICAgICAgICAgIGxhc3REb3dubG9hZGVkID0gZG93bmxvYWRlZDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmaWxlU3RyZWFtLmVuZCgpO1xuXG4gICAgICAvLyBXYWl0IGZvciBmaWxlIHRvIGJlIGZ1bGx5IHdyaXR0ZW5cbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZmlsZVN0cmVhbS5vbignZmluaXNoJywgcmVzb2x2ZSk7XG4gICAgICAgIGZpbGVTdHJlYW0ub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBNb3ZlIHRlbXAgZmlsZSB0byBmaW5hbCBkZXN0aW5hdGlvblxuICAgICAgaWYgKGV4aXN0c1N5bmMoZGVzdFBhdGgpKSB7XG4gICAgICAgIHVubGlua1N5bmMoZGVzdFBhdGgpO1xuICAgICAgfVxuICAgICAgcmVuYW1lU3luYyh0ZW1wUGF0aCwgZGVzdFBhdGgpO1xuXG4gICAgICByZXR1cm4gZGVzdFBhdGg7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIENsZWFuIHVwIHRlbXAgZmlsZSBvbiBlcnJvclxuICAgICAgaWYgKGV4aXN0c1N5bmModGVtcFBhdGgpKSB7XG4gICAgICAgIHRyeSB7IHVubGlua1N5bmModGVtcFBhdGgpOyB9IGNhdGNoIHt9XG4gICAgICB9XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRG93bmxvYWQgYWxsIGF2YWlsYWJsZSBtb2RlbHNcbiAgICovXG4gIGFzeW5jIGRvd25sb2FkQWxsKG9wdGlvbnM6IERvd25sb2FkT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgbW9kZWwgb2YgbGlzdE1vZGVscygpKSB7XG4gICAgICBjb25zdCBwYXRoID0gYXdhaXQgdGhpcy5kb3dubG9hZChtb2RlbC5pZCwgb3B0aW9ucyk7XG4gICAgICBwYXRocy5wdXNoKHBhdGgpO1xuICAgIH1cbiAgICByZXR1cm4gcGF0aHM7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGEgZG93bmxvYWRlZCBtb2RlbFxuICAgKi9cbiAgZGVsZXRlKG1vZGVsSWRPckFsaWFzOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5nZXRNb2RlbFBhdGgobW9kZWxJZE9yQWxpYXMpO1xuICAgIGlmICghcGF0aCB8fCAhZXhpc3RzU3luYyhwYXRoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB1bmxpbmtTeW5jKHBhdGgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhbGwgZG93bmxvYWRlZCBtb2RlbHNcbiAgICovXG4gIGRlbGV0ZUFsbCgpOiBudW1iZXIge1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgZm9yIChjb25zdCBtb2RlbCBvZiBsaXN0TW9kZWxzKCkpIHtcbiAgICAgIGlmICh0aGlzLmRlbGV0ZShtb2RlbC5pZCkpIHtcbiAgICAgICAgY291bnQrKztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvdW50O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1vZGVsRG93bmxvYWRlcjtcbiJdfQ==