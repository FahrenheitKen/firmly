"use strict";
/**
 * Contrastive Fine-tuning for RuvLTRA Claude Code Router
 *
 * Uses triplet loss to fine-tune embeddings:
 * - Anchor: task description
 * - Positive: correct agent description
 * - Negative: wrong agent description (hard negative)
 *
 * Goal: minimize distance(anchor, positive) and maximize distance(anchor, negative)
 *
 * @example
 * ```typescript
 * import { ContrastiveTrainer, tripletLoss, infoNCELoss } from '@ruvector/ruvllm';
 *
 * const trainer = new ContrastiveTrainer({
 *   epochs: 10,
 *   batchSize: 16,
 *   margin: 0.5,
 * });
 *
 * // Add triplets
 * trainer.addTriplet(anchorEmb, positiveEmb, negativeEmb, true);
 *
 * // Train and export
 * const results = trainer.train();
 * trainer.exportTrainingData('./output');
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_TRAINING_DATA = exports.ContrastiveTrainer = void 0;
exports.cosineSimilarity = cosineSimilarity;
exports.tripletLoss = tripletLoss;
exports.infoNCELoss = infoNCELoss;
exports.computeGradient = computeGradient;
exports.generateTrainingDataset = generateTrainingDataset;
exports.generateContrastivePairs = generateContrastivePairs;
exports.getDatasetStats = getDatasetStats;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Default contrastive config
 */
const DEFAULT_CONTRASTIVE_CONFIG = {
    epochs: 10,
    batchSize: 16,
    learningRate: 0.0001,
    margin: 0.5,
    temperature: 0.07,
    hardNegativeRatio: 0.7,
    outputPath: './training-output',
};
/**
 * Compute cosine similarity between two embeddings
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
/**
 * Compute triplet loss
 * L = max(0, margin + d(anchor, positive) - d(anchor, negative))
 */
function tripletLoss(anchorEmb, positiveEmb, negativeEmb, margin = 0.5) {
    const posDist = 1 - cosineSimilarity(anchorEmb, positiveEmb);
    const negDist = 1 - cosineSimilarity(anchorEmb, negativeEmb);
    return Math.max(0, margin + posDist - negDist);
}
/**
 * Compute InfoNCE loss (contrastive)
 */
function infoNCELoss(anchorEmb, positiveEmb, negativeEmbs, temperature = 0.07) {
    const posSim = cosineSimilarity(anchorEmb, positiveEmb) / temperature;
    const negSims = negativeEmbs.map(neg => cosineSimilarity(anchorEmb, neg) / temperature);
    // Softmax denominator
    const maxSim = Math.max(posSim, ...negSims);
    const expPos = Math.exp(posSim - maxSim);
    const expNegs = negSims.map(sim => Math.exp(sim - maxSim));
    const denominator = expPos + expNegs.reduce((a, b) => a + b, 0);
    // Cross-entropy loss
    return -Math.log(expPos / denominator);
}
/**
 * Compute gradient for embedding update (simplified)
 */
function computeGradient(anchorEmb, positiveEmb, negativeEmb, lr = 0.0001) {
    const dim = anchorEmb.length;
    const gradient = new Array(dim).fill(0);
    // Pull anchor towards positive
    for (let i = 0; i < dim; i++) {
        gradient[i] += lr * (positiveEmb[i] - anchorEmb[i]);
    }
    // Push anchor away from negative
    for (let i = 0; i < dim; i++) {
        gradient[i] -= lr * 0.5 * (negativeEmb[i] - anchorEmb[i]);
    }
    return gradient;
}
/**
 * Contrastive Trainer for RuvLTRA models
 *
 * Implements triplet loss and InfoNCE loss for embedding fine-tuning.
 */
class ContrastiveTrainer {
    constructor(config) {
        this.triplets = [];
        this.history = [];
        this.agentEmbeddings = new Map();
        this.config = { ...DEFAULT_CONTRASTIVE_CONFIG, ...config };
    }
    /**
     * Add a training triplet
     */
    addTriplet(anchor, anchorEmb, positive, positiveEmb, negative, negativeEmb, isHard = false) {
        this.triplets.push({
            anchor,
            anchorEmb,
            positive,
            positiveEmb,
            negative,
            negativeEmb,
            isHard,
        });
    }
    /**
     * Add agent embedding for reference
     */
    addAgentEmbedding(agentName, embedding) {
        this.agentEmbeddings.set(agentName, embedding);
    }
    /**
     * Get all agent embeddings
     */
    getAgentEmbeddings() {
        return this.agentEmbeddings;
    }
    /**
     * Get triplet count
     */
    getTripletCount() {
        return this.triplets.length;
    }
    /**
     * Simulate training (compute losses without actual backprop)
     * In a full implementation, this would use proper gradient descent
     */
    train() {
        const startTime = Date.now();
        const { epochs, batchSize, margin } = this.config;
        if (this.triplets.length === 0) {
            return {
                tripletCount: 0,
                finalLoss: 0,
                initialLoss: 0,
                improvement: 0,
                history: [],
                durationMs: 0,
            };
        }
        for (let epoch = 0; epoch < epochs; epoch++) {
            let epochLoss = 0;
            let batchCount = 0;
            // Shuffle triplets
            const shuffled = [...this.triplets].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffled.length; i += batchSize) {
                const batch = shuffled.slice(i, i + batchSize);
                let batchLoss = 0;
                for (const triplet of batch) {
                    const loss = tripletLoss(triplet.anchorEmb, triplet.positiveEmb, triplet.negativeEmb, margin);
                    batchLoss += loss;
                }
                epochLoss += batchLoss / batch.length;
                batchCount++;
            }
            const avgLoss = epochLoss / batchCount;
            this.history.push({ epoch: epoch + 1, loss: avgLoss });
        }
        const initialLoss = this.history[0]?.loss || 0;
        const finalLoss = this.history[this.history.length - 1]?.loss || 0;
        const improvement = initialLoss > 0 ? (1 - finalLoss / initialLoss) * 100 : 0;
        return {
            tripletCount: this.triplets.length,
            finalLoss,
            initialLoss,
            improvement,
            history: this.history,
            durationMs: Date.now() - startTime,
        };
    }
    /**
     * Export training data for external fine-tuning tools
     */
    exportTrainingData(outputPath) {
        const outDir = outputPath || this.config.outputPath;
        if (!(0, fs_1.existsSync)(outDir)) {
            (0, fs_1.mkdirSync)(outDir, { recursive: true });
        }
        // JSONL format for fine-tuning
        const jsonlData = this.triplets.map(t => ({
            anchor: t.anchor,
            positive: t.positive,
            negative: t.negative,
            isHard: t.isHard,
        }));
        // CSV format for analysis
        const csvData = [
            'anchor,positive,negative,is_hard',
            ...this.triplets.map(t => `"${t.anchor.replace(/"/g, '""')}",${t.positive},${t.negative},${t.isHard}`),
        ].join('\n');
        // Embedding matrix for direct training
        const embeddingData = {
            anchors: this.triplets.map(t => t.anchorEmb),
            positives: this.triplets.map(t => t.positiveEmb),
            negatives: this.triplets.map(t => t.negativeEmb),
            labels: this.triplets.map(t => t.positive),
        };
        (0, fs_1.writeFileSync)((0, path_1.join)(outDir, 'triplets.jsonl'), jsonlData.map(item => JSON.stringify(item)).join('\n'));
        (0, fs_1.writeFileSync)((0, path_1.join)(outDir, 'triplets.csv'), csvData);
        (0, fs_1.writeFileSync)((0, path_1.join)(outDir, 'embeddings.json'), JSON.stringify(embeddingData, null, 2));
        return outDir;
    }
    /**
     * Generate LoRA adapter configuration
     */
    generateLoRAConfig(outputPath) {
        const outDir = outputPath || this.config.outputPath;
        const loraConfig = {
            model_type: 'qwen2',
            base_model: 'Qwen/Qwen2.5-0.5B',
            output_dir: outDir,
            lora_r: 8,
            lora_alpha: 16,
            lora_dropout: 0.05,
            target_modules: ['q_proj', 'v_proj', 'k_proj', 'o_proj'],
            learning_rate: this.config.learningRate,
            num_train_epochs: this.config.epochs,
            per_device_train_batch_size: this.config.batchSize,
            gradient_accumulation_steps: 4,
            warmup_ratio: 0.1,
            loss_type: 'triplet',
            margin: this.config.margin,
            temperature: this.config.temperature,
            train_data: (0, path_1.join)(outDir, 'triplets.jsonl'),
            eval_data: (0, path_1.join)(outDir, 'eval.jsonl'),
        };
        if (!(0, fs_1.existsSync)(outDir)) {
            (0, fs_1.mkdirSync)(outDir, { recursive: true });
        }
        (0, fs_1.writeFileSync)((0, path_1.join)(outDir, 'lora_config.json'), JSON.stringify(loraConfig, null, 2));
        return loraConfig;
    }
    /**
     * Generate training script for external tools
     */
    generateTrainingScript(outputPath) {
        const outDir = outputPath || this.config.outputPath;
        const script = `#!/bin/bash
# RuvLTRA Fine-tuning Script
# Prerequisites: pip install transformers peft accelerate

set -e

MODEL_PATH="${outDir}"
BASE_MODEL="Qwen/Qwen2.5-0.5B"

echo "=== RuvLTRA Contrastive Fine-tuning ==="
echo "Base model: $BASE_MODEL"
echo "Output: $MODEL_PATH"

# Check for training data
if [ ! -f "$MODEL_PATH/triplets.jsonl" ]; then
  echo "Error: Training data not found at $MODEL_PATH/triplets.jsonl"
  exit 1
fi

# Install dependencies if needed
python3 -c "import transformers, peft" 2>/dev/null || {
  echo "Installing dependencies..."
  pip install transformers peft accelerate sentencepiece
}

# Fine-tune with LoRA
python3 << 'PYTHON'
import json
import torch
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType

# Load config
config_path = Path("${outDir}/lora_config.json")
with open(config_path) as f:
    config = json.load(f)

print(f"Loading base model: {config['base_model']}")

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained(config['base_model'])
model = AutoModelForCausalLM.from_pretrained(
    config['base_model'],
    torch_dtype=torch.float16,
    device_map='auto'
)

# Configure LoRA
lora_config = LoraConfig(
    r=config['lora_r'],
    lora_alpha=config['lora_alpha'],
    lora_dropout=config['lora_dropout'],
    target_modules=config['target_modules'],
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

print("Model ready for fine-tuning!")
print(f"Training data: {config['train_data']}")
print("Note: Full training requires GPU. This script validates the setup.")
PYTHON

echo ""
echo "=== Setup Complete ==="
echo "To train on GPU, run the full training pipeline."
echo "Training data exported to: $MODEL_PATH/triplets.jsonl"
`;
        if (!(0, fs_1.existsSync)(outDir)) {
            (0, fs_1.mkdirSync)(outDir, { recursive: true });
        }
        const scriptPath = (0, path_1.join)(outDir, 'train.sh');
        (0, fs_1.writeFileSync)(scriptPath, script);
        return scriptPath;
    }
    /**
     * Get training history
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Reset trainer
     */
    reset() {
        this.triplets = [];
        this.history = [];
    }
}
exports.ContrastiveTrainer = ContrastiveTrainer;
/**
 * Agent Training Data for Claude Code Router
 */
exports.AGENT_TRAINING_DATA = {
    coder: {
        description: 'Implementation specialist for writing clean, efficient code. Handles coding tasks, feature implementation, and code generation.',
        keywords: ['implement', 'code', 'write', 'build', 'create', 'develop', 'function', 'class', 'component', 'feature'],
        examples: [
            'Implement a binary search function',
            'Write a React component for user registration',
            'Create a REST API endpoint for user authentication',
            'Build a caching layer for the database queries',
        ],
        confusing_with: ['refactorer', 'debugger'],
    },
    tester: {
        description: 'Testing specialist for writing and maintaining tests. Creates unit tests, integration tests, and ensures code quality through testing.',
        keywords: ['test', 'unit test', 'integration test', 'coverage', 'mock', 'assertion', 'spec', 'jest', 'pytest'],
        examples: [
            'Write unit tests for the authentication module',
            'Add integration tests for the payment gateway',
            'Create test coverage for the user service',
            'Write e2e tests for the checkout flow',
        ],
        confusing_with: ['reviewer'],
    },
    reviewer: {
        description: 'Code review specialist for analyzing code quality, identifying issues, and suggesting improvements.',
        keywords: ['review', 'analyze', 'check', 'inspect', 'audit', 'evaluate', 'assess', 'critique'],
        examples: [
            'Review the pull request for code quality',
            'Check the code for potential security vulnerabilities',
            'Analyze the implementation for best practices',
            'Evaluate the architecture decisions in this PR',
        ],
        confusing_with: ['tester', 'security-architect'],
    },
    researcher: {
        description: 'Research specialist for investigating technologies, gathering information, and analyzing options.',
        keywords: ['research', 'investigate', 'explore', 'analyze', 'study', 'compare', 'evaluate', 'learn'],
        examples: [
            'Research best practices for React state management',
            'Investigate the performance issues in the dashboard',
            'Compare different authentication strategies',
            'Study the codebase architecture for the new feature',
        ],
        confusing_with: ['planner'],
    },
    architect: {
        description: 'System architect for designing software architecture, making technical decisions, and planning system structure.',
        keywords: ['design', 'architect', 'structure', 'plan', 'schema', 'model', 'pattern', 'system'],
        examples: [
            'Design the database schema for user profiles',
            'Plan the architecture for real-time notifications',
            'Create a system design for the microservices migration',
            'Design the API structure for the new product catalog',
        ],
        confusing_with: ['planner'],
    },
    debugger: {
        description: 'Debugging specialist for finding and fixing bugs, analyzing errors, and troubleshooting issues.',
        keywords: ['debug', 'fix', 'bug', 'error', 'issue', 'crash', 'exception', 'troubleshoot'],
        examples: [
            'Fix the null pointer exception in the login handler',
            'Debug the memory leak in the WebSocket handler',
            'Troubleshoot the race condition in the payment processor',
            'Find the root cause of the intermittent test failures',
        ],
        confusing_with: ['coder'],
    },
    'security-architect': {
        description: 'Security specialist for auditing code security, identifying vulnerabilities, and implementing security measures.',
        keywords: ['security', 'vulnerability', 'xss', 'sql injection', 'auth', 'encryption', 'audit', 'penetration'],
        examples: [
            'Audit the API endpoints for XSS vulnerabilities',
            'Review the authentication flow for security issues',
            'Implement input validation for the user forms',
            'Check for SQL injection vulnerabilities in the search',
        ],
        confusing_with: ['reviewer'],
    },
    documenter: {
        description: 'Documentation specialist for writing technical documentation, comments, and API docs.',
        keywords: ['document', 'comment', 'jsdoc', 'readme', 'docs', 'explain', 'describe', 'annotate'],
        examples: [
            'Write JSDoc comments for the utility functions',
            'Create README documentation for the new module',
            'Document the API endpoints with examples',
            'Add inline comments explaining the algorithm',
        ],
        confusing_with: ['api-docs'],
    },
    refactorer: {
        description: 'Refactoring specialist for improving code structure, cleaning up technical debt, and modernizing codebases.',
        keywords: ['refactor', 'clean', 'restructure', 'modernize', 'improve', 'simplify', 'extract', 'rename'],
        examples: [
            'Refactor the payment module to use async/await',
            'Clean up the legacy authentication code',
            'Extract common logic into a shared utility',
            'Simplify the complex conditional logic in checkout',
        ],
        confusing_with: ['coder'],
    },
    optimizer: {
        description: 'Performance optimization specialist for improving speed, reducing memory usage, and optimizing queries.',
        keywords: ['optimize', 'performance', 'speed', 'memory', 'cache', 'index', 'query', 'latency'],
        examples: [
            'Optimize the database queries for the dashboard',
            'Improve the page load time for the homepage',
            'Add caching to reduce API response times',
            'Reduce memory usage in the image processing pipeline',
        ],
        confusing_with: ['researcher'],
    },
    devops: {
        description: 'DevOps specialist for CI/CD pipelines, deployment automation, and infrastructure management.',
        keywords: ['deploy', 'ci/cd', 'pipeline', 'docker', 'kubernetes', 'terraform', 'aws', 'infrastructure'],
        examples: [
            'Set up the CI/CD pipeline for the microservices',
            'Configure Docker containers for the application',
            'Deploy the application to the staging environment',
            'Create Terraform scripts for the AWS infrastructure',
        ],
        confusing_with: [],
    },
    'api-docs': {
        description: 'API documentation specialist for creating OpenAPI specs, Swagger documentation, and API references.',
        keywords: ['openapi', 'swagger', 'api docs', 'endpoint', 'specification', 'schema', 'rest'],
        examples: [
            'Generate OpenAPI documentation for the REST API',
            'Create Swagger specs for the user endpoints',
            'Document the API authentication requirements',
            'Update the API reference with new endpoints',
        ],
        confusing_with: ['documenter'],
    },
    planner: {
        description: 'Project planning specialist for creating task plans, sprint planning, and roadmap development.',
        keywords: ['plan', 'roadmap', 'sprint', 'milestone', 'timeline', 'estimate', 'breakdown', 'prioritize'],
        examples: [
            'Create a sprint plan for the next two weeks',
            'Break down the feature into smaller tasks',
            'Estimate the effort for the migration project',
            'Prioritize the bug fixes for the release',
        ],
        confusing_with: ['architect', 'researcher'],
    },
};
/**
 * Generate training dataset from agent data
 */
function generateTrainingDataset() {
    const examples = [];
    for (const [agent, data] of Object.entries(exports.AGENT_TRAINING_DATA)) {
        // Add direct examples
        for (const example of data.examples) {
            examples.push({
                task: example,
                agent,
                complexity: 'medium',
            });
        }
        // Generate variations with keywords
        for (const keyword of data.keywords) {
            examples.push({
                task: `${keyword} a solution for the authentication system`,
                agent,
                complexity: 'low',
            });
        }
        // Add confusing pairs for hard negatives
        if (data.confusing_with) {
            for (const confusingAgent of data.confusing_with) {
                for (const example of data.examples.slice(0, 2)) {
                    examples.push({
                        task: example,
                        agent,
                        complexity: 'hard',
                        confusing_with: confusingAgent,
                    });
                }
            }
        }
    }
    return examples;
}
/**
 * Generate contrastive pairs for training
 */
function generateContrastivePairs() {
    const pairs = [];
    const agents = Object.keys(exports.AGENT_TRAINING_DATA);
    for (const [agent, data] of Object.entries(exports.AGENT_TRAINING_DATA)) {
        for (const example of data.examples) {
            // Hard negatives from confusing agents
            if (data.confusing_with) {
                for (const negAgent of data.confusing_with) {
                    pairs.push({
                        anchor: example,
                        positive: agent,
                        negative: negAgent,
                        isHard: true,
                    });
                }
            }
            // Random negatives
            const randomNegs = agents.filter(a => a !== agent).slice(0, 2);
            for (const negAgent of randomNegs) {
                pairs.push({
                    anchor: example,
                    positive: agent,
                    negative: negAgent,
                    isHard: false,
                });
            }
        }
    }
    return pairs;
}
/**
 * Get dataset statistics
 */
function getDatasetStats() {
    const examples = generateTrainingDataset();
    const pairs = generateContrastivePairs();
    const agents = Object.keys(exports.AGENT_TRAINING_DATA);
    return {
        totalExamples: examples.length,
        contrastivePairs: pairs.length,
        agentTypes: agents.length,
        agents,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJhc3RpdmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29udHJhc3RpdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0EyQkc7OztBQTRHSCw0Q0FTQztBQU1ELGtDQVNDO0FBS0Qsa0NBaUJDO0FBS0QsMENBb0JDO0FBbWVELDBEQXNDQztBQUtELDREQXFDQztBQUtELDBDQVdDO0FBcHZCRCwyQkFBMEQ7QUFDMUQsK0JBQTRCO0FBeUY1Qjs7R0FFRztBQUNILE1BQU0sMEJBQTBCLEdBQWdDO0lBQzlELE1BQU0sRUFBRSxFQUFFO0lBQ1YsU0FBUyxFQUFFLEVBQUU7SUFDYixZQUFZLEVBQUUsTUFBTTtJQUNwQixNQUFNLEVBQUUsR0FBRztJQUNYLFdBQVcsRUFBRSxJQUFJO0lBQ2pCLGlCQUFpQixFQUFFLEdBQUc7SUFDdEIsVUFBVSxFQUFFLG1CQUFtQjtDQUNoQyxDQUFDO0FBRUY7O0dBRUc7QUFDSCxTQUFnQixnQkFBZ0IsQ0FBQyxDQUFZLEVBQUUsQ0FBWTtJQUN6RCxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE1BQU07UUFBRSxPQUFPLENBQUMsQ0FBQztJQUNoRCxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDbEMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkIsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDckIs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QUssR0FBRyx3QkFBd0IsRUFBRSxDQUFDO0lBQ3pDLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsMkJBQW1CLENBQUMsQ0FBQztJQUVoRCxPQUFPO1FBQ0wsYUFBYSxFQUFFLFFBQVEsQ0FBQyxNQUFNO1FBQzlCLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxNQUFNO1FBQzlCLFVBQVUsRUFBRSxNQUFNLENBQUMsTUFBTTtRQUN6QixNQUFNO0tBQ1AsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbnRyYXN0aXZlIEZpbmUtdHVuaW5nIGZvciBSdXZMVFJBIENsYXVkZSBDb2RlIFJvdXRlclxuICpcbiAqIFVzZXMgdHJpcGxldCBsb3NzIHRvIGZpbmUtdHVuZSBlbWJlZGRpbmdzOlxuICogLSBBbmNob3I6IHRhc2sgZGVzY3JpcHRpb25cbiAqIC0gUG9zaXRpdmU6IGNvcnJlY3QgYWdlbnQgZGVzY3JpcHRpb25cbiAqIC0gTmVnYXRpdmU6IHdyb25nIGFnZW50IGRlc2NyaXB0aW9uIChoYXJkIG5lZ2F0aXZlKVxuICpcbiAqIEdvYWw6IG1pbmltaXplIGRpc3RhbmNlKGFuY2hvciwgcG9zaXRpdmUpIGFuZCBtYXhpbWl6ZSBkaXN0YW5jZShhbmNob3IsIG5lZ2F0aXZlKVxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBDb250cmFzdGl2ZVRyYWluZXIsIHRyaXBsZXRMb3NzLCBpbmZvTkNFTG9zcyB9IGZyb20gJ0BydXZlY3Rvci9ydXZsbG0nO1xuICpcbiAqIGNvbnN0IHRyYWluZXIgPSBuZXcgQ29udHJhc3RpdmVUcmFpbmVyKHtcbiAqICAgZXBvY2hzOiAxMCxcbiAqICAgYmF0Y2hTaXplOiAxNixcbiAqICAgbWFyZ2luOiAwLjUsXG4gKiB9KTtcbiAqXG4gKiAvLyBBZGQgdHJpcGxldHNcbiAqIHRyYWluZXIuYWRkVHJpcGxldChhbmNob3JFbWIsIHBvc2l0aXZlRW1iLCBuZWdhdGl2ZUVtYiwgdHJ1ZSk7XG4gKlxuICogLy8gVHJhaW4gYW5kIGV4cG9ydFxuICogY29uc3QgcmVzdWx0cyA9IHRyYWluZXIudHJhaW4oKTtcbiAqIHRyYWluZXIuZXhwb3J0VHJhaW5pbmdEYXRhKCcuL291dHB1dCcpO1xuICogYGBgXG4gKi9cblxuaW1wb3J0IHsgd3JpdGVGaWxlU3luYywgbWtkaXJTeW5jLCBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgRW1iZWRkaW5nIH0gZnJvbSAnLi90eXBlcyc7XG5cbi8qKlxuICogQ29udHJhc3RpdmUgdHJhaW5pbmcgY29uZmlndXJhdGlvblxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbnRyYXN0aXZlQ29uZmlnIHtcbiAgLyoqIE51bWJlciBvZiB0cmFpbmluZyBlcG9jaHMgKGRlZmF1bHQ6IDEwKSAqL1xuICBlcG9jaHM/OiBudW1iZXI7XG4gIC8qKiBCYXRjaCBzaXplIChkZWZhdWx0OiAxNikgKi9cbiAgYmF0Y2hTaXplPzogbnVtYmVyO1xuICAvKiogTGVhcm5pbmcgcmF0ZSAoZGVmYXVsdDogMC4wMDAxKSAqL1xuICBsZWFybmluZ1JhdGU/OiBudW1iZXI7XG4gIC8qKiBUcmlwbGV0IGxvc3MgbWFyZ2luIChkZWZhdWx0OiAwLjUpICovXG4gIG1hcmdpbj86IG51bWJlcjtcbiAgLyoqIEluZm9OQ0UgdGVtcGVyYXR1cmUgKGRlZmF1bHQ6IDAuMDcpICovXG4gIHRlbXBlcmF0dXJlPzogbnVtYmVyO1xuICAvKiogUmF0aW8gb2YgaGFyZCBuZWdhdGl2ZXMgKGRlZmF1bHQ6IDAuNykgKi9cbiAgaGFyZE5lZ2F0aXZlUmF0aW8/OiBudW1iZXI7XG4gIC8qKiBPdXRwdXQgZGlyZWN0b3J5IGZvciB0cmFpbmluZyBkYXRhICovXG4gIG91dHB1dFBhdGg/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogVHJhaW5pbmcgdHJpcGxldFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRyYWluaW5nVHJpcGxldCB7XG4gIC8qKiBBbmNob3IgZW1iZWRkaW5nICh0YXNrKSAqL1xuICBhbmNob3I6IHN0cmluZztcbiAgYW5jaG9yRW1iOiBFbWJlZGRpbmc7XG4gIC8qKiBQb3NpdGl2ZSBleGFtcGxlIChjb3JyZWN0IGFnZW50KSAqL1xuICBwb3NpdGl2ZTogc3RyaW5nO1xuICBwb3NpdGl2ZUVtYjogRW1iZWRkaW5nO1xuICAvKiogTmVnYXRpdmUgZXhhbXBsZSAod3JvbmcgYWdlbnQpICovXG4gIG5lZ2F0aXZlOiBzdHJpbmc7XG4gIG5lZ2F0aXZlRW1iOiBFbWJlZGRpbmc7XG4gIC8qKiBXaGV0aGVyIHRoaXMgaXMgYSBoYXJkIG5lZ2F0aXZlICovXG4gIGlzSGFyZDogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBUcmFpbmluZyBoaXN0b3J5IGVudHJ5XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVHJhaW5pbmdIaXN0b3J5RW50cnkge1xuICBlcG9jaDogbnVtYmVyO1xuICBsb3NzOiBudW1iZXI7XG59XG5cbi8qKlxuICogQ29udHJhc3RpdmUgdHJhaW5pbmcgcmVzdWx0c1xuICovXG5leHBvcnQgaW50ZXJmYWNlIENvbnRyYXN0aXZlVHJhaW5pbmdSZXN1bHQge1xuICAvKiogVG90YWwgdHJpcGxldHMgdHJhaW5lZCBvbiAqL1xuICB0cmlwbGV0Q291bnQ6IG51bWJlcjtcbiAgLyoqIEZpbmFsIGxvc3MgdmFsdWUgKi9cbiAgZmluYWxMb3NzOiBudW1iZXI7XG4gIC8qKiBJbml0aWFsIGxvc3MgdmFsdWUgKi9cbiAgaW5pdGlhbExvc3M6IG51bWJlcjtcbiAgLyoqIEltcHJvdmVtZW50IHBlcmNlbnRhZ2UgKi9cbiAgaW1wcm92ZW1lbnQ6IG51bWJlcjtcbiAgLyoqIFRyYWluaW5nIGhpc3RvcnkgKi9cbiAgaGlzdG9yeTogVHJhaW5pbmdIaXN0b3J5RW50cnlbXTtcbiAgLyoqIER1cmF0aW9uIGluIG1zICovXG4gIGR1cmF0aW9uTXM6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBMb1JBIGNvbmZpZ3VyYXRpb24gZm9yIGZpbmUtdHVuaW5nXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTG9SQUV4cG9ydENvbmZpZyB7XG4gIG1vZGVsX3R5cGU6IHN0cmluZztcbiAgYmFzZV9tb2RlbDogc3RyaW5nO1xuICBvdXRwdXRfZGlyOiBzdHJpbmc7XG4gIGxvcmFfcjogbnVtYmVyO1xuICBsb3JhX2FscGhhOiBudW1iZXI7XG4gIGxvcmFfZHJvcG91dDogbnVtYmVyO1xuICB0YXJnZXRfbW9kdWxlczogc3RyaW5nW107XG4gIGxlYXJuaW5nX3JhdGU6IG51bWJlcjtcbiAgbnVtX3RyYWluX2Vwb2NoczogbnVtYmVyO1xuICBwZXJfZGV2aWNlX3RyYWluX2JhdGNoX3NpemU6IG51bWJlcjtcbiAgZ3JhZGllbnRfYWNjdW11bGF0aW9uX3N0ZXBzOiBudW1iZXI7XG4gIHdhcm11cF9yYXRpbzogbnVtYmVyO1xuICBsb3NzX3R5cGU6IHN0cmluZztcbiAgbWFyZ2luOiBudW1iZXI7XG4gIHRlbXBlcmF0dXJlOiBudW1iZXI7XG4gIHRyYWluX2RhdGE6IHN0cmluZztcbiAgZXZhbF9kYXRhOiBzdHJpbmc7XG59XG5cbi8qKlxuICogRGVmYXVsdCBjb250cmFzdGl2ZSBjb25maWdcbiAqL1xuY29uc3QgREVGQVVMVF9DT05UUkFTVElWRV9DT05GSUc6IFJlcXVpcmVkPENvbnRyYXN0aXZlQ29uZmlnPiA9IHtcbiAgZXBvY2hzOiAxMCxcbiAgYmF0Y2hTaXplOiAxNixcbiAgbGVhcm5pbmdSYXRlOiAwLjAwMDEsXG4gIG1hcmdpbjogMC41LFxuICB0ZW1wZXJhdHVyZTogMC4wNyxcbiAgaGFyZE5lZ2F0aXZlUmF0aW86IDAuNyxcbiAgb3V0cHV0UGF0aDogJy4vdHJhaW5pbmctb3V0cHV0Jyxcbn07XG5cbi8qKlxuICogQ29tcHV0ZSBjb3NpbmUgc2ltaWxhcml0eSBiZXR3ZWVuIHR3byBlbWJlZGRpbmdzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb3NpbmVTaW1pbGFyaXR5KGE6IEVtYmVkZGluZywgYjogRW1iZWRkaW5nKTogbnVtYmVyIHtcbiAgaWYgKCFhIHx8ICFiIHx8IGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIDA7XG4gIGxldCBkb3QgPSAwLCBub3JtQSA9IDAsIG5vcm1CID0gMDtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgZG90ICs9IGFbaV0gKiBiW2ldO1xuICAgIG5vcm1BICs9IGFbaV0gKiBhW2ldO1xuICAgIG5vcm1CICs9IGJbaV0gKiBiW2ldO1xuICB9XG4gIHJldHVybiBkb3QgLyAoTWF0aC5zcXJ0KG5vcm1BKSAqIE1hdGguc3FydChub3JtQikgfHwgMSk7XG59XG5cbi8qKlxuICogQ29tcHV0ZSB0cmlwbGV0IGxvc3NcbiAqIEwgPSBtYXgoMCwgbWFyZ2luICsgZChhbmNob3IsIHBvc2l0aXZlKSAtIGQoYW5jaG9yLCBuZWdhdGl2ZSkpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmlwbGV0TG9zcyhcbiAgYW5jaG9yRW1iOiBFbWJlZGRpbmcsXG4gIHBvc2l0aXZlRW1iOiBFbWJlZGRpbmcsXG4gIG5lZ2F0aXZlRW1iOiBFbWJlZGRpbmcsXG4gIG1hcmdpbjogbnVtYmVyID0gMC41XG4pOiBudW1iZXIge1xuICBjb25zdCBwb3NEaXN0ID0gMSAtIGNvc2luZVNpbWlsYXJpdHkoYW5jaG9yRW1iLCBwb3NpdGl2ZUVtYik7XG4gIGNvbnN0IG5lZ0Rpc3QgPSAxIC0gY29zaW5lU2ltaWxhcml0eShhbmNob3JFbWIsIG5lZ2F0aXZlRW1iKTtcbiAgcmV0dXJuIE1hdGgubWF4KDAsIG1hcmdpbiArIHBvc0Rpc3QgLSBuZWdEaXN0KTtcbn1cblxuLyoqXG4gKiBDb21wdXRlIEluZm9OQ0UgbG9zcyAoY29udHJhc3RpdmUpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmZvTkNFTG9zcyhcbiAgYW5jaG9yRW1iOiBFbWJlZGRpbmcsXG4gIHBvc2l0aXZlRW1iOiBFbWJlZGRpbmcsXG4gIG5lZ2F0aXZlRW1iczogRW1iZWRkaW5nW10sXG4gIHRlbXBlcmF0dXJlOiBudW1iZXIgPSAwLjA3XG4pOiBudW1iZXIge1xuICBjb25zdCBwb3NTaW0gPSBjb3NpbmVTaW1pbGFyaXR5KGFuY2hvckVtYiwgcG9zaXRpdmVFbWIpIC8gdGVtcGVyYXR1cmU7XG4gIGNvbnN0IG5lZ1NpbXMgPSBuZWdhdGl2ZUVtYnMubWFwKG5lZyA9PiBjb3NpbmVTaW1pbGFyaXR5KGFuY2hvckVtYiwgbmVnKSAvIHRlbXBlcmF0dXJlKTtcblxuICAvLyBTb2Z0bWF4IGRlbm9taW5hdG9yXG4gIGNvbnN0IG1heFNpbSA9IE1hdGgubWF4KHBvc1NpbSwgLi4ubmVnU2ltcyk7XG4gIGNvbnN0IGV4cFBvcyA9IE1hdGguZXhwKHBvc1NpbSAtIG1heFNpbSk7XG4gIGNvbnN0IGV4cE5lZ3MgPSBuZWdTaW1zLm1hcChzaW0gPT4gTWF0aC5leHAoc2ltIC0gbWF4U2ltKSk7XG4gIGNvbnN0IGRlbm9taW5hdG9yID0gZXhwUG9zICsgZXhwTmVncy5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKTtcblxuICAvLyBDcm9zcy1lbnRyb3B5IGxvc3NcbiAgcmV0dXJuIC1NYXRoLmxvZyhleHBQb3MgLyBkZW5vbWluYXRvcik7XG59XG5cbi8qKlxuICogQ29tcHV0ZSBncmFkaWVudCBmb3IgZW1iZWRkaW5nIHVwZGF0ZSAoc2ltcGxpZmllZClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVHcmFkaWVudChcbiAgYW5jaG9yRW1iOiBFbWJlZGRpbmcsXG4gIHBvc2l0aXZlRW1iOiBFbWJlZGRpbmcsXG4gIG5lZ2F0aXZlRW1iOiBFbWJlZGRpbmcsXG4gIGxyOiBudW1iZXIgPSAwLjAwMDFcbik6IEVtYmVkZGluZyB7XG4gIGNvbnN0IGRpbSA9IGFuY2hvckVtYi5sZW5ndGg7XG4gIGNvbnN0IGdyYWRpZW50OiBudW1iZXJbXSA9IG5ldyBBcnJheShkaW0pLmZpbGwoMCk7XG5cbiAgLy8gUHVsbCBhbmNob3IgdG93YXJkcyBwb3NpdGl2ZVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGRpbTsgaSsrKSB7XG4gICAgZ3JhZGllbnRbaV0gKz0gbHIgKiAocG9zaXRpdmVFbWJbaV0gLSBhbmNob3JFbWJbaV0pO1xuICB9XG5cbiAgLy8gUHVzaCBhbmNob3IgYXdheSBmcm9tIG5lZ2F0aXZlXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgZGltOyBpKyspIHtcbiAgICBncmFkaWVudFtpXSAtPSBsciAqIDAuNSAqIChuZWdhdGl2ZUVtYltpXSAtIGFuY2hvckVtYltpXSk7XG4gIH1cblxuICByZXR1cm4gZ3JhZGllbnQ7XG59XG5cbi8qKlxuICogQ29udHJhc3RpdmUgVHJhaW5lciBmb3IgUnV2TFRSQSBtb2RlbHNcbiAqXG4gKiBJbXBsZW1lbnRzIHRyaXBsZXQgbG9zcyBhbmQgSW5mb05DRSBsb3NzIGZvciBlbWJlZGRpbmcgZmluZS10dW5pbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb250cmFzdGl2ZVRyYWluZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8Q29udHJhc3RpdmVDb25maWc+O1xuICBwcml2YXRlIHRyaXBsZXRzOiBUcmFpbmluZ1RyaXBsZXRbXSA9IFtdO1xuICBwcml2YXRlIGhpc3Rvcnk6IFRyYWluaW5nSGlzdG9yeUVudHJ5W10gPSBbXTtcbiAgcHJpdmF0ZSBhZ2VudEVtYmVkZGluZ3M6IE1hcDxzdHJpbmcsIEVtYmVkZGluZz4gPSBuZXcgTWFwKCk7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnPzogQ29udHJhc3RpdmVDb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZyA9IHsgLi4uREVGQVVMVF9DT05UUkFTVElWRV9DT05GSUcsIC4uLmNvbmZpZyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhIHRyYWluaW5nIHRyaXBsZXRcbiAgICovXG4gIGFkZFRyaXBsZXQoXG4gICAgYW5jaG9yOiBzdHJpbmcsXG4gICAgYW5jaG9yRW1iOiBFbWJlZGRpbmcsXG4gICAgcG9zaXRpdmU6IHN0cmluZyxcbiAgICBwb3NpdGl2ZUVtYjogRW1iZWRkaW5nLFxuICAgIG5lZ2F0aXZlOiBzdHJpbmcsXG4gICAgbmVnYXRpdmVFbWI6IEVtYmVkZGluZyxcbiAgICBpc0hhcmQ6IGJvb2xlYW4gPSBmYWxzZVxuICApOiB2b2lkIHtcbiAgICB0aGlzLnRyaXBsZXRzLnB1c2goe1xuICAgICAgYW5jaG9yLFxuICAgICAgYW5jaG9yRW1iLFxuICAgICAgcG9zaXRpdmUsXG4gICAgICBwb3NpdGl2ZUVtYixcbiAgICAgIG5lZ2F0aXZlLFxuICAgICAgbmVnYXRpdmVFbWIsXG4gICAgICBpc0hhcmQsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGFnZW50IGVtYmVkZGluZyBmb3IgcmVmZXJlbmNlXG4gICAqL1xuICBhZGRBZ2VudEVtYmVkZGluZyhhZ2VudE5hbWU6IHN0cmluZywgZW1iZWRkaW5nOiBFbWJlZGRpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmFnZW50RW1iZWRkaW5ncy5zZXQoYWdlbnROYW1lLCBlbWJlZGRpbmcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhbGwgYWdlbnQgZW1iZWRkaW5nc1xuICAgKi9cbiAgZ2V0QWdlbnRFbWJlZGRpbmdzKCk6IE1hcDxzdHJpbmcsIEVtYmVkZGluZz4ge1xuICAgIHJldHVybiB0aGlzLmFnZW50RW1iZWRkaW5ncztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdHJpcGxldCBjb3VudFxuICAgKi9cbiAgZ2V0VHJpcGxldENvdW50KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMudHJpcGxldHMubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIFNpbXVsYXRlIHRyYWluaW5nIChjb21wdXRlIGxvc3NlcyB3aXRob3V0IGFjdHVhbCBiYWNrcHJvcClcbiAgICogSW4gYSBmdWxsIGltcGxlbWVudGF0aW9uLCB0aGlzIHdvdWxkIHVzZSBwcm9wZXIgZ3JhZGllbnQgZGVzY2VudFxuICAgKi9cbiAgdHJhaW4oKTogQ29udHJhc3RpdmVUcmFpbmluZ1Jlc3VsdCB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCB7IGVwb2NocywgYmF0Y2hTaXplLCBtYXJnaW4gfSA9IHRoaXMuY29uZmlnO1xuXG4gICAgaWYgKHRoaXMudHJpcGxldHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0cmlwbGV0Q291bnQ6IDAsXG4gICAgICAgIGZpbmFsTG9zczogMCxcbiAgICAgICAgaW5pdGlhbExvc3M6IDAsXG4gICAgICAgIGltcHJvdmVtZW50OiAwLFxuICAgICAgICBoaXN0b3J5OiBbXSxcbiAgICAgICAgZHVyYXRpb25NczogMCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZm9yIChsZXQgZXBvY2ggPSAwOyBlcG9jaCA8IGVwb2NoczsgZXBvY2grKykge1xuICAgICAgbGV0IGVwb2NoTG9zcyA9IDA7XG4gICAgICBsZXQgYmF0Y2hDb3VudCA9IDA7XG5cbiAgICAgIC8vIFNodWZmbGUgdHJpcGxldHNcbiAgICAgIGNvbnN0IHNodWZmbGVkID0gWy4uLnRoaXMudHJpcGxldHNdLnNvcnQoKCkgPT4gTWF0aC5yYW5kb20oKSAtIDAuNSk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2h1ZmZsZWQubGVuZ3RoOyBpICs9IGJhdGNoU2l6ZSkge1xuICAgICAgICBjb25zdCBiYXRjaCA9IHNodWZmbGVkLnNsaWNlKGksIGkgKyBiYXRjaFNpemUpO1xuICAgICAgICBsZXQgYmF0Y2hMb3NzID0gMDtcblxuICAgICAgICBmb3IgKGNvbnN0IHRyaXBsZXQgb2YgYmF0Y2gpIHtcbiAgICAgICAgICBjb25zdCBsb3NzID0gdHJpcGxldExvc3MoXG4gICAgICAgICAgICB0cmlwbGV0LmFuY2hvckVtYixcbiAgICAgICAgICAgIHRyaXBsZXQucG9zaXRpdmVFbWIsXG4gICAgICAgICAgICB0cmlwbGV0Lm5lZ2F0aXZlRW1iLFxuICAgICAgICAgICAgbWFyZ2luXG4gICAgICAgICAgKTtcbiAgICAgICAgICBiYXRjaExvc3MgKz0gbG9zcztcbiAgICAgICAgfVxuXG4gICAgICAgIGVwb2NoTG9zcyArPSBiYXRjaExvc3MgLyBiYXRjaC5sZW5ndGg7XG4gICAgICAgIGJhdGNoQ291bnQrKztcbiAgICAgIH1cblxuICAgICAgY29uc3QgYXZnTG9zcyA9IGVwb2NoTG9zcyAvIGJhdGNoQ291bnQ7XG4gICAgICB0aGlzLmhpc3RvcnkucHVzaCh7IGVwb2NoOiBlcG9jaCArIDEsIGxvc3M6IGF2Z0xvc3MgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgaW5pdGlhbExvc3MgPSB0aGlzLmhpc3RvcnlbMF0/Lmxvc3MgfHwgMDtcbiAgICBjb25zdCBmaW5hbExvc3MgPSB0aGlzLmhpc3RvcnlbdGhpcy5oaXN0b3J5Lmxlbmd0aCAtIDFdPy5sb3NzIHx8IDA7XG4gICAgY29uc3QgaW1wcm92ZW1lbnQgPSBpbml0aWFsTG9zcyA+IDAgPyAoMSAtIGZpbmFsTG9zcyAvIGluaXRpYWxMb3NzKSAqIDEwMCA6IDA7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdHJpcGxldENvdW50OiB0aGlzLnRyaXBsZXRzLmxlbmd0aCxcbiAgICAgIGZpbmFsTG9zcyxcbiAgICAgIGluaXRpYWxMb3NzLFxuICAgICAgaW1wcm92ZW1lbnQsXG4gICAgICBoaXN0b3J5OiB0aGlzLmhpc3RvcnksXG4gICAgICBkdXJhdGlvbk1zOiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRXhwb3J0IHRyYWluaW5nIGRhdGEgZm9yIGV4dGVybmFsIGZpbmUtdHVuaW5nIHRvb2xzXG4gICAqL1xuICBleHBvcnRUcmFpbmluZ0RhdGEob3V0cHV0UGF0aD86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3Qgb3V0RGlyID0gb3V0cHV0UGF0aCB8fCB0aGlzLmNvbmZpZy5vdXRwdXRQYXRoO1xuXG4gICAgaWYgKCFleGlzdHNTeW5jKG91dERpcikpIHtcbiAgICAgIG1rZGlyU3luYyhvdXREaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH1cblxuICAgIC8vIEpTT05MIGZvcm1hdCBmb3IgZmluZS10dW5pbmdcbiAgICBjb25zdCBqc29ubERhdGEgPSB0aGlzLnRyaXBsZXRzLm1hcCh0ID0+ICh7XG4gICAgICBhbmNob3I6IHQuYW5jaG9yLFxuICAgICAgcG9zaXRpdmU6IHQucG9zaXRpdmUsXG4gICAgICBuZWdhdGl2ZTogdC5uZWdhdGl2ZSxcbiAgICAgIGlzSGFyZDogdC5pc0hhcmQsXG4gICAgfSkpO1xuXG4gICAgLy8gQ1NWIGZvcm1hdCBmb3IgYW5hbHlzaXNcbiAgICBjb25zdCBjc3ZEYXRhID0gW1xuICAgICAgJ2FuY2hvcixwb3NpdGl2ZSxuZWdhdGl2ZSxpc19oYXJkJyxcbiAgICAgIC4uLnRoaXMudHJpcGxldHMubWFwKHQgPT5cbiAgICAgICAgYFwiJHt0LmFuY2hvci5yZXBsYWNlKC9cIi9nLCAnXCJcIicpfVwiLCR7dC5wb3NpdGl2ZX0sJHt0Lm5lZ2F0aXZlfSwke3QuaXNIYXJkfWBcbiAgICAgICksXG4gICAgXS5qb2luKCdcXG4nKTtcblxuICAgIC8vIEVtYmVkZGluZyBtYXRyaXggZm9yIGRpcmVjdCB0cmFpbmluZ1xuICAgIGNvbnN0IGVtYmVkZGluZ0RhdGEgPSB7XG4gICAgICBhbmNob3JzOiB0aGlzLnRyaXBsZXRzLm1hcCh0ID0+IHQuYW5jaG9yRW1iKSxcbiAgICAgIHBvc2l0aXZlczogdGhpcy50cmlwbGV0cy5tYXAodCA9PiB0LnBvc2l0aXZlRW1iKSxcbiAgICAgIG5lZ2F0aXZlczogdGhpcy50cmlwbGV0cy5tYXAodCA9PiB0Lm5lZ2F0aXZlRW1iKSxcbiAgICAgIGxhYmVsczogdGhpcy50cmlwbGV0cy5tYXAodCA9PiB0LnBvc2l0aXZlKSxcbiAgICB9O1xuXG4gICAgd3JpdGVGaWxlU3luYyhqb2luKG91dERpciwgJ3RyaXBsZXRzLmpzb25sJyksIGpzb25sRGF0YS5tYXAoaXRlbSA9PiBKU09OLnN0cmluZ2lmeShpdGVtKSkuam9pbignXFxuJykpO1xuICAgIHdyaXRlRmlsZVN5bmMoam9pbihvdXREaXIsICd0cmlwbGV0cy5jc3YnKSwgY3N2RGF0YSk7XG4gICAgd3JpdGVGaWxlU3luYyhqb2luKG91dERpciwgJ2VtYmVkZGluZ3MuanNvbicpLCBKU09OLnN0cmluZ2lmeShlbWJlZGRpbmdEYXRhLCBudWxsLCAyKSk7XG5cbiAgICByZXR1cm4gb3V0RGlyO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIExvUkEgYWRhcHRlciBjb25maWd1cmF0aW9uXG4gICAqL1xuICBnZW5lcmF0ZUxvUkFDb25maWcob3V0cHV0UGF0aD86IHN0cmluZyk6IExvUkFFeHBvcnRDb25maWcge1xuICAgIGNvbnN0IG91dERpciA9IG91dHB1dFBhdGggfHwgdGhpcy5jb25maWcub3V0cHV0UGF0aDtcblxuICAgIGNvbnN0IGxvcmFDb25maWc6IExvUkFFeHBvcnRDb25maWcgPSB7XG4gICAgICBtb2RlbF90eXBlOiAncXdlbjInLFxuICAgICAgYmFzZV9tb2RlbDogJ1F3ZW4vUXdlbjIuNS0wLjVCJyxcbiAgICAgIG91dHB1dF9kaXI6IG91dERpcixcbiAgICAgIGxvcmFfcjogOCxcbiAgICAgIGxvcmFfYWxwaGE6IDE2LFxuICAgICAgbG9yYV9kcm9wb3V0OiAwLjA1LFxuICAgICAgdGFyZ2V0X21vZHVsZXM6IFsncV9wcm9qJywgJ3ZfcHJvaicsICdrX3Byb2onLCAnb19wcm9qJ10sXG4gICAgICBsZWFybmluZ19yYXRlOiB0aGlzLmNvbmZpZy5sZWFybmluZ1JhdGUsXG4gICAgICBudW1fdHJhaW5fZXBvY2hzOiB0aGlzLmNvbmZpZy5lcG9jaHMsXG4gICAgICBwZXJfZGV2aWNlX3RyYWluX2JhdGNoX3NpemU6IHRoaXMuY29uZmlnLmJhdGNoU2l6ZSxcbiAgICAgIGdyYWRpZW50X2FjY3VtdWxhdGlvbl9zdGVwczogNCxcbiAgICAgIHdhcm11cF9yYXRpbzogMC4xLFxuICAgICAgbG9zc190eXBlOiAndHJpcGxldCcsXG4gICAgICBtYXJnaW46IHRoaXMuY29uZmlnLm1hcmdpbixcbiAgICAgIHRlbXBlcmF0dXJlOiB0aGlzLmNvbmZpZy50ZW1wZXJhdHVyZSxcbiAgICAgIHRyYWluX2RhdGE6IGpvaW4ob3V0RGlyLCAndHJpcGxldHMuanNvbmwnKSxcbiAgICAgIGV2YWxfZGF0YTogam9pbihvdXREaXIsICdldmFsLmpzb25sJyksXG4gICAgfTtcblxuICAgIGlmICghZXhpc3RzU3luYyhvdXREaXIpKSB7XG4gICAgICBta2RpclN5bmMob3V0RGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICB9XG5cbiAgICB3cml0ZUZpbGVTeW5jKGpvaW4ob3V0RGlyLCAnbG9yYV9jb25maWcuanNvbicpLCBKU09OLnN0cmluZ2lmeShsb3JhQ29uZmlnLCBudWxsLCAyKSk7XG4gICAgcmV0dXJuIGxvcmFDb25maWc7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgdHJhaW5pbmcgc2NyaXB0IGZvciBleHRlcm5hbCB0b29sc1xuICAgKi9cbiAgZ2VuZXJhdGVUcmFpbmluZ1NjcmlwdChvdXRwdXRQYXRoPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBvdXREaXIgPSBvdXRwdXRQYXRoIHx8IHRoaXMuY29uZmlnLm91dHB1dFBhdGg7XG5cbiAgICBjb25zdCBzY3JpcHQgPSBgIyEvYmluL2Jhc2hcbiMgUnV2TFRSQSBGaW5lLXR1bmluZyBTY3JpcHRcbiMgUHJlcmVxdWlzaXRlczogcGlwIGluc3RhbGwgdHJhbnNmb3JtZXJzIHBlZnQgYWNjZWxlcmF0ZVxuXG5zZXQgLWVcblxuTU9ERUxfUEFUSD1cIiR7b3V0RGlyfVwiXG5CQVNFX01PREVMPVwiUXdlbi9Rd2VuMi41LTAuNUJcIlxuXG5lY2hvIFwiPT09IFJ1dkxUUkEgQ29udHJhc3RpdmUgRmluZS10dW5pbmcgPT09XCJcbmVjaG8gXCJCYXNlIG1vZGVsOiAkQkFTRV9NT0RFTFwiXG5lY2hvIFwiT3V0cHV0OiAkTU9ERUxfUEFUSFwiXG5cbiMgQ2hlY2sgZm9yIHRyYWluaW5nIGRhdGFcbmlmIFsgISAtZiBcIiRNT0RFTF9QQVRIL3RyaXBsZXRzLmpzb25sXCIgXTsgdGhlblxuICBlY2hvIFwiRXJyb3I6IFRyYWluaW5nIGRhdGEgbm90IGZvdW5kIGF0ICRNT0RFTF9QQVRIL3RyaXBsZXRzLmpzb25sXCJcbiAgZXhpdCAxXG5maVxuXG4jIEluc3RhbGwgZGVwZW5kZW5jaWVzIGlmIG5lZWRlZFxucHl0aG9uMyAtYyBcImltcG9ydCB0cmFuc2Zvcm1lcnMsIHBlZnRcIiAyPi9kZXYvbnVsbCB8fCB7XG4gIGVjaG8gXCJJbnN0YWxsaW5nIGRlcGVuZGVuY2llcy4uLlwiXG4gIHBpcCBpbnN0YWxsIHRyYW5zZm9ybWVycyBwZWZ0IGFjY2VsZXJhdGUgc2VudGVuY2VwaWVjZVxufVxuXG4jIEZpbmUtdHVuZSB3aXRoIExvUkFcbnB5dGhvbjMgPDwgJ1BZVEhPTidcbmltcG9ydCBqc29uXG5pbXBvcnQgdG9yY2hcbmZyb20gcGF0aGxpYiBpbXBvcnQgUGF0aFxuZnJvbSB0cmFuc2Zvcm1lcnMgaW1wb3J0IEF1dG9Nb2RlbEZvckNhdXNhbExNLCBBdXRvVG9rZW5pemVyXG5mcm9tIHBlZnQgaW1wb3J0IExvcmFDb25maWcsIGdldF9wZWZ0X21vZGVsLCBUYXNrVHlwZVxuXG4jIExvYWQgY29uZmlnXG5jb25maWdfcGF0aCA9IFBhdGgoXCIke291dERpcn0vbG9yYV9jb25maWcuanNvblwiKVxud2l0aCBvcGVuKGNvbmZpZ19wYXRoKSBhcyBmOlxuICAgIGNvbmZpZyA9IGpzb24ubG9hZChmKVxuXG5wcmludChmXCJMb2FkaW5nIGJhc2UgbW9kZWw6IHtjb25maWdbJ2Jhc2VfbW9kZWwnXX1cIilcblxuIyBMb2FkIG1vZGVsIGFuZCB0b2tlbml6ZXJcbnRva2VuaXplciA9IEF1dG9Ub2tlbml6ZXIuZnJvbV9wcmV0cmFpbmVkKGNvbmZpZ1snYmFzZV9tb2RlbCddKVxubW9kZWwgPSBBdXRvTW9kZWxGb3JDYXVzYWxMTS5mcm9tX3ByZXRyYWluZWQoXG4gICAgY29uZmlnWydiYXNlX21vZGVsJ10sXG4gICAgdG9yY2hfZHR5cGU9dG9yY2guZmxvYXQxNixcbiAgICBkZXZpY2VfbWFwPSdhdXRvJ1xuKVxuXG4jIENvbmZpZ3VyZSBMb1JBXG5sb3JhX2NvbmZpZyA9IExvcmFDb25maWcoXG4gICAgcj1jb25maWdbJ2xvcmFfciddLFxuICAgIGxvcmFfYWxwaGE9Y29uZmlnWydsb3JhX2FscGhhJ10sXG4gICAgbG9yYV9kcm9wb3V0PWNvbmZpZ1snbG9yYV9kcm9wb3V0J10sXG4gICAgdGFyZ2V0X21vZHVsZXM9Y29uZmlnWyd0YXJnZXRfbW9kdWxlcyddLFxuICAgIHRhc2tfdHlwZT1UYXNrVHlwZS5DQVVTQUxfTE0sXG4pXG5cbm1vZGVsID0gZ2V0X3BlZnRfbW9kZWwobW9kZWwsIGxvcmFfY29uZmlnKVxubW9kZWwucHJpbnRfdHJhaW5hYmxlX3BhcmFtZXRlcnMoKVxuXG5wcmludChcIk1vZGVsIHJlYWR5IGZvciBmaW5lLXR1bmluZyFcIilcbnByaW50KGZcIlRyYWluaW5nIGRhdGE6IHtjb25maWdbJ3RyYWluX2RhdGEnXX1cIilcbnByaW50KFwiTm90ZTogRnVsbCB0cmFpbmluZyByZXF1aXJlcyBHUFUuIFRoaXMgc2NyaXB0IHZhbGlkYXRlcyB0aGUgc2V0dXAuXCIpXG5QWVRIT05cblxuZWNobyBcIlwiXG5lY2hvIFwiPT09IFNldHVwIENvbXBsZXRlID09PVwiXG5lY2hvIFwiVG8gdHJhaW4gb24gR1BVLCBydW4gdGhlIGZ1bGwgdHJhaW5pbmcgcGlwZWxpbmUuXCJcbmVjaG8gXCJUcmFpbmluZyBkYXRhIGV4cG9ydGVkIHRvOiAkTU9ERUxfUEFUSC90cmlwbGV0cy5qc29ubFwiXG5gO1xuXG4gICAgaWYgKCFleGlzdHNTeW5jKG91dERpcikpIHtcbiAgICAgIG1rZGlyU3luYyhvdXREaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHNjcmlwdFBhdGggPSBqb2luKG91dERpciwgJ3RyYWluLnNoJyk7XG4gICAgd3JpdGVGaWxlU3luYyhzY3JpcHRQYXRoLCBzY3JpcHQpO1xuXG4gICAgcmV0dXJuIHNjcmlwdFBhdGg7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRyYWluaW5nIGhpc3RvcnlcbiAgICovXG4gIGdldEhpc3RvcnkoKTogVHJhaW5pbmdIaXN0b3J5RW50cnlbXSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLmhpc3RvcnldO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHRyYWluZXJcbiAgICovXG4gIHJlc2V0KCk6IHZvaWQge1xuICAgIHRoaXMudHJpcGxldHMgPSBbXTtcbiAgICB0aGlzLmhpc3RvcnkgPSBbXTtcbiAgfVxufVxuXG4vKipcbiAqIEFnZW50IFRyYWluaW5nIERhdGEgSW50ZXJmYWNlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQWdlbnRUcmFpbmluZ0RhdGEge1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICBrZXl3b3Jkczogc3RyaW5nW107XG4gIGV4YW1wbGVzOiBzdHJpbmdbXTtcbiAgY29uZnVzaW5nX3dpdGg/OiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBUcmFpbmluZyBFeGFtcGxlIEludGVyZmFjZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFRyYWluaW5nRXhhbXBsZSB7XG4gIHRhc2s6IHN0cmluZztcbiAgYWdlbnQ6IHN0cmluZztcbiAgY29tcGxleGl0eT86IHN0cmluZztcbiAgY29uZnVzaW5nX3dpdGg/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogRGF0YXNldCBTdGF0aXN0aWNzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YXNldFN0YXRzIHtcbiAgdG90YWxFeGFtcGxlczogbnVtYmVyO1xuICBjb250cmFzdGl2ZVBhaXJzOiBudW1iZXI7XG4gIGFnZW50VHlwZXM6IG51bWJlcjtcbiAgYWdlbnRzOiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBBZ2VudCBUcmFpbmluZyBEYXRhIGZvciBDbGF1ZGUgQ29kZSBSb3V0ZXJcbiAqL1xuZXhwb3J0IGNvbnN0IEFHRU5UX1RSQUlOSU5HX0RBVEE6IFJlY29yZDxzdHJpbmcsIEFnZW50VHJhaW5pbmdEYXRhPiA9IHtcbiAgY29kZXI6IHtcbiAgICBkZXNjcmlwdGlvbjogJ0ltcGxlbWVudGF0aW9uIHNwZWNpYWxpc3QgZm9yIHdyaXRpbmcgY2xlYW4sIGVmZmljaWVudCBjb2RlLiBIYW5kbGVzIGNvZGluZyB0YXNrcywgZmVhdHVyZSBpbXBsZW1lbnRhdGlvbiwgYW5kIGNvZGUgZ2VuZXJhdGlvbi4nLFxuICAgIGtleXdvcmRzOiBbJ2ltcGxlbWVudCcsICdjb2RlJywgJ3dyaXRlJywgJ2J1aWxkJywgJ2NyZWF0ZScsICdkZXZlbG9wJywgJ2Z1bmN0aW9uJywgJ2NsYXNzJywgJ2NvbXBvbmVudCcsICdmZWF0dXJlJ10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdJbXBsZW1lbnQgYSBiaW5hcnkgc2VhcmNoIGZ1bmN0aW9uJyxcbiAgICAgICdXcml0ZSBhIFJlYWN0IGNvbXBvbmVudCBmb3IgdXNlciByZWdpc3RyYXRpb24nLFxuICAgICAgJ0NyZWF0ZSBhIFJFU1QgQVBJIGVuZHBvaW50IGZvciB1c2VyIGF1dGhlbnRpY2F0aW9uJyxcbiAgICAgICdCdWlsZCBhIGNhY2hpbmcgbGF5ZXIgZm9yIHRoZSBkYXRhYmFzZSBxdWVyaWVzJyxcbiAgICBdLFxuICAgIGNvbmZ1c2luZ193aXRoOiBbJ3JlZmFjdG9yZXInLCAnZGVidWdnZXInXSxcbiAgfSxcbiAgdGVzdGVyOiB7XG4gICAgZGVzY3JpcHRpb246ICdUZXN0aW5nIHNwZWNpYWxpc3QgZm9yIHdyaXRpbmcgYW5kIG1haW50YWluaW5nIHRlc3RzLiBDcmVhdGVzIHVuaXQgdGVzdHMsIGludGVncmF0aW9uIHRlc3RzLCBhbmQgZW5zdXJlcyBjb2RlIHF1YWxpdHkgdGhyb3VnaCB0ZXN0aW5nLicsXG4gICAga2V5d29yZHM6IFsndGVzdCcsICd1bml0IHRlc3QnLCAnaW50ZWdyYXRpb24gdGVzdCcsICdjb3ZlcmFnZScsICdtb2NrJywgJ2Fzc2VydGlvbicsICdzcGVjJywgJ2plc3QnLCAncHl0ZXN0J10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdXcml0ZSB1bml0IHRlc3RzIGZvciB0aGUgYXV0aGVudGljYXRpb24gbW9kdWxlJyxcbiAgICAgICdBZGQgaW50ZWdyYXRpb24gdGVzdHMgZm9yIHRoZSBwYXltZW50IGdhdGV3YXknLFxuICAgICAgJ0NyZWF0ZSB0ZXN0IGNvdmVyYWdlIGZvciB0aGUgdXNlciBzZXJ2aWNlJyxcbiAgICAgICdXcml0ZSBlMmUgdGVzdHMgZm9yIHRoZSBjaGVja291dCBmbG93JyxcbiAgICBdLFxuICAgIGNvbmZ1c2luZ193aXRoOiBbJ3Jldmlld2VyJ10sXG4gIH0sXG4gIHJldmlld2VyOiB7XG4gICAgZGVzY3JpcHRpb246ICdDb2RlIHJldmlldyBzcGVjaWFsaXN0IGZvciBhbmFseXppbmcgY29kZSBxdWFsaXR5LCBpZGVudGlmeWluZyBpc3N1ZXMsIGFuZCBzdWdnZXN0aW5nIGltcHJvdmVtZW50cy4nLFxuICAgIGtleXdvcmRzOiBbJ3JldmlldycsICdhbmFseXplJywgJ2NoZWNrJywgJ2luc3BlY3QnLCAnYXVkaXQnLCAnZXZhbHVhdGUnLCAnYXNzZXNzJywgJ2NyaXRpcXVlJ10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdSZXZpZXcgdGhlIHB1bGwgcmVxdWVzdCBmb3IgY29kZSBxdWFsaXR5JyxcbiAgICAgICdDaGVjayB0aGUgY29kZSBmb3IgcG90ZW50aWFsIHNlY3VyaXR5IHZ1bG5lcmFiaWxpdGllcycsXG4gICAgICAnQW5hbHl6ZSB0aGUgaW1wbGVtZW50YXRpb24gZm9yIGJlc3QgcHJhY3RpY2VzJyxcbiAgICAgICdFdmFsdWF0ZSB0aGUgYXJjaGl0ZWN0dXJlIGRlY2lzaW9ucyBpbiB0aGlzIFBSJyxcbiAgICBdLFxuICAgIGNvbmZ1c2luZ193aXRoOiBbJ3Rlc3RlcicsICdzZWN1cml0eS1hcmNoaXRlY3QnXSxcbiAgfSxcbiAgcmVzZWFyY2hlcjoge1xuICAgIGRlc2NyaXB0aW9uOiAnUmVzZWFyY2ggc3BlY2lhbGlzdCBmb3IgaW52ZXN0aWdhdGluZyB0ZWNobm9sb2dpZXMsIGdhdGhlcmluZyBpbmZvcm1hdGlvbiwgYW5kIGFuYWx5emluZyBvcHRpb25zLicsXG4gICAga2V5d29yZHM6IFsncmVzZWFyY2gnLCAnaW52ZXN0aWdhdGUnLCAnZXhwbG9yZScsICdhbmFseXplJywgJ3N0dWR5JywgJ2NvbXBhcmUnLCAnZXZhbHVhdGUnLCAnbGVhcm4nXSxcbiAgICBleGFtcGxlczogW1xuICAgICAgJ1Jlc2VhcmNoIGJlc3QgcHJhY3RpY2VzIGZvciBSZWFjdCBzdGF0ZSBtYW5hZ2VtZW50JyxcbiAgICAgICdJbnZlc3RpZ2F0ZSB0aGUgcGVyZm9ybWFuY2UgaXNzdWVzIGluIHRoZSBkYXNoYm9hcmQnLFxuICAgICAgJ0NvbXBhcmUgZGlmZmVyZW50IGF1dGhlbnRpY2F0aW9uIHN0cmF0ZWdpZXMnLFxuICAgICAgJ1N0dWR5IHRoZSBjb2RlYmFzZSBhcmNoaXRlY3R1cmUgZm9yIHRoZSBuZXcgZmVhdHVyZScsXG4gICAgXSxcbiAgICBjb25mdXNpbmdfd2l0aDogWydwbGFubmVyJ10sXG4gIH0sXG4gIGFyY2hpdGVjdDoge1xuICAgIGRlc2NyaXB0aW9uOiAnU3lzdGVtIGFyY2hpdGVjdCBmb3IgZGVzaWduaW5nIHNvZnR3YXJlIGFyY2hpdGVjdHVyZSwgbWFraW5nIHRlY2huaWNhbCBkZWNpc2lvbnMsIGFuZCBwbGFubmluZyBzeXN0ZW0gc3RydWN0dXJlLicsXG4gICAga2V5d29yZHM6IFsnZGVzaWduJywgJ2FyY2hpdGVjdCcsICdzdHJ1Y3R1cmUnLCAncGxhbicsICdzY2hlbWEnLCAnbW9kZWwnLCAncGF0dGVybicsICdzeXN0ZW0nXSxcbiAgICBleGFtcGxlczogW1xuICAgICAgJ0Rlc2lnbiB0aGUgZGF0YWJhc2Ugc2NoZW1hIGZvciB1c2VyIHByb2ZpbGVzJyxcbiAgICAgICdQbGFuIHRoZSBhcmNoaXRlY3R1cmUgZm9yIHJlYWwtdGltZSBub3RpZmljYXRpb25zJyxcbiAgICAgICdDcmVhdGUgYSBzeXN0ZW0gZGVzaWduIGZvciB0aGUgbWljcm9zZXJ2aWNlcyBtaWdyYXRpb24nLFxuICAgICAgJ0Rlc2lnbiB0aGUgQVBJIHN0cnVjdHVyZSBmb3IgdGhlIG5ldyBwcm9kdWN0IGNhdGFsb2cnLFxuICAgIF0sXG4gICAgY29uZnVzaW5nX3dpdGg6IFsncGxhbm5lciddLFxuICB9LFxuICBkZWJ1Z2dlcjoge1xuICAgIGRlc2NyaXB0aW9uOiAnRGVidWdnaW5nIHNwZWNpYWxpc3QgZm9yIGZpbmRpbmcgYW5kIGZpeGluZyBidWdzLCBhbmFseXppbmcgZXJyb3JzLCBhbmQgdHJvdWJsZXNob290aW5nIGlzc3Vlcy4nLFxuICAgIGtleXdvcmRzOiBbJ2RlYnVnJywgJ2ZpeCcsICdidWcnLCAnZXJyb3InLCAnaXNzdWUnLCAnY3Jhc2gnLCAnZXhjZXB0aW9uJywgJ3Ryb3VibGVzaG9vdCddLFxuICAgIGV4YW1wbGVzOiBbXG4gICAgICAnRml4IHRoZSBudWxsIHBvaW50ZXIgZXhjZXB0aW9uIGluIHRoZSBsb2dpbiBoYW5kbGVyJyxcbiAgICAgICdEZWJ1ZyB0aGUgbWVtb3J5IGxlYWsgaW4gdGhlIFdlYlNvY2tldCBoYW5kbGVyJyxcbiAgICAgICdUcm91Ymxlc2hvb3QgdGhlIHJhY2UgY29uZGl0aW9uIGluIHRoZSBwYXltZW50IHByb2Nlc3NvcicsXG4gICAgICAnRmluZCB0aGUgcm9vdCBjYXVzZSBvZiB0aGUgaW50ZXJtaXR0ZW50IHRlc3QgZmFpbHVyZXMnLFxuICAgIF0sXG4gICAgY29uZnVzaW5nX3dpdGg6IFsnY29kZXInXSxcbiAgfSxcbiAgJ3NlY3VyaXR5LWFyY2hpdGVjdCc6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IHNwZWNpYWxpc3QgZm9yIGF1ZGl0aW5nIGNvZGUgc2VjdXJpdHksIGlkZW50aWZ5aW5nIHZ1bG5lcmFiaWxpdGllcywgYW5kIGltcGxlbWVudGluZyBzZWN1cml0eSBtZWFzdXJlcy4nLFxuICAgIGtleXdvcmRzOiBbJ3NlY3VyaXR5JywgJ3Z1bG5lcmFiaWxpdHknLCAneHNzJywgJ3NxbCBpbmplY3Rpb24nLCAnYXV0aCcsICdlbmNyeXB0aW9uJywgJ2F1ZGl0JywgJ3BlbmV0cmF0aW9uJ10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdBdWRpdCB0aGUgQVBJIGVuZHBvaW50cyBmb3IgWFNTIHZ1bG5lcmFiaWxpdGllcycsXG4gICAgICAnUmV2aWV3IHRoZSBhdXRoZW50aWNhdGlvbiBmbG93IGZvciBzZWN1cml0eSBpc3N1ZXMnLFxuICAgICAgJ0ltcGxlbWVudCBpbnB1dCB2YWxpZGF0aW9uIGZvciB0aGUgdXNlciBmb3JtcycsXG4gICAgICAnQ2hlY2sgZm9yIFNRTCBpbmplY3Rpb24gdnVsbmVyYWJpbGl0aWVzIGluIHRoZSBzZWFyY2gnLFxuICAgIF0sXG4gICAgY29uZnVzaW5nX3dpdGg6IFsncmV2aWV3ZXInXSxcbiAgfSxcbiAgZG9jdW1lbnRlcjoge1xuICAgIGRlc2NyaXB0aW9uOiAnRG9jdW1lbnRhdGlvbiBzcGVjaWFsaXN0IGZvciB3cml0aW5nIHRlY2huaWNhbCBkb2N1bWVudGF0aW9uLCBjb21tZW50cywgYW5kIEFQSSBkb2NzLicsXG4gICAga2V5d29yZHM6IFsnZG9jdW1lbnQnLCAnY29tbWVudCcsICdqc2RvYycsICdyZWFkbWUnLCAnZG9jcycsICdleHBsYWluJywgJ2Rlc2NyaWJlJywgJ2Fubm90YXRlJ10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdXcml0ZSBKU0RvYyBjb21tZW50cyBmb3IgdGhlIHV0aWxpdHkgZnVuY3Rpb25zJyxcbiAgICAgICdDcmVhdGUgUkVBRE1FIGRvY3VtZW50YXRpb24gZm9yIHRoZSBuZXcgbW9kdWxlJyxcbiAgICAgICdEb2N1bWVudCB0aGUgQVBJIGVuZHBvaW50cyB3aXRoIGV4YW1wbGVzJyxcbiAgICAgICdBZGQgaW5saW5lIGNvbW1lbnRzIGV4cGxhaW5pbmcgdGhlIGFsZ29yaXRobScsXG4gICAgXSxcbiAgICBjb25mdXNpbmdfd2l0aDogWydhcGktZG9jcyddLFxuICB9LFxuICByZWZhY3RvcmVyOiB7XG4gICAgZGVzY3JpcHRpb246ICdSZWZhY3RvcmluZyBzcGVjaWFsaXN0IGZvciBpbXByb3ZpbmcgY29kZSBzdHJ1Y3R1cmUsIGNsZWFuaW5nIHVwIHRlY2huaWNhbCBkZWJ0LCBhbmQgbW9kZXJuaXppbmcgY29kZWJhc2VzLicsXG4gICAga2V5d29yZHM6IFsncmVmYWN0b3InLCAnY2xlYW4nLCAncmVzdHJ1Y3R1cmUnLCAnbW9kZXJuaXplJywgJ2ltcHJvdmUnLCAnc2ltcGxpZnknLCAnZXh0cmFjdCcsICdyZW5hbWUnXSxcbiAgICBleGFtcGxlczogW1xuICAgICAgJ1JlZmFjdG9yIHRoZSBwYXltZW50IG1vZHVsZSB0byB1c2UgYXN5bmMvYXdhaXQnLFxuICAgICAgJ0NsZWFuIHVwIHRoZSBsZWdhY3kgYXV0aGVudGljYXRpb24gY29kZScsXG4gICAgICAnRXh0cmFjdCBjb21tb24gbG9naWMgaW50byBhIHNoYXJlZCB1dGlsaXR5JyxcbiAgICAgICdTaW1wbGlmeSB0aGUgY29tcGxleCBjb25kaXRpb25hbCBsb2dpYyBpbiBjaGVja291dCcsXG4gICAgXSxcbiAgICBjb25mdXNpbmdfd2l0aDogWydjb2RlciddLFxuICB9LFxuICBvcHRpbWl6ZXI6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1BlcmZvcm1hbmNlIG9wdGltaXphdGlvbiBzcGVjaWFsaXN0IGZvciBpbXByb3Zpbmcgc3BlZWQsIHJlZHVjaW5nIG1lbW9yeSB1c2FnZSwgYW5kIG9wdGltaXppbmcgcXVlcmllcy4nLFxuICAgIGtleXdvcmRzOiBbJ29wdGltaXplJywgJ3BlcmZvcm1hbmNlJywgJ3NwZWVkJywgJ21lbW9yeScsICdjYWNoZScsICdpbmRleCcsICdxdWVyeScsICdsYXRlbmN5J10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdPcHRpbWl6ZSB0aGUgZGF0YWJhc2UgcXVlcmllcyBmb3IgdGhlIGRhc2hib2FyZCcsXG4gICAgICAnSW1wcm92ZSB0aGUgcGFnZSBsb2FkIHRpbWUgZm9yIHRoZSBob21lcGFnZScsXG4gICAgICAnQWRkIGNhY2hpbmcgdG8gcmVkdWNlIEFQSSByZXNwb25zZSB0aW1lcycsXG4gICAgICAnUmVkdWNlIG1lbW9yeSB1c2FnZSBpbiB0aGUgaW1hZ2UgcHJvY2Vzc2luZyBwaXBlbGluZScsXG4gICAgXSxcbiAgICBjb25mdXNpbmdfd2l0aDogWydyZXNlYXJjaGVyJ10sXG4gIH0sXG4gIGRldm9wczoge1xuICAgIGRlc2NyaXB0aW9uOiAnRGV2T3BzIHNwZWNpYWxpc3QgZm9yIENJL0NEIHBpcGVsaW5lcywgZGVwbG95bWVudCBhdXRvbWF0aW9uLCBhbmQgaW5mcmFzdHJ1Y3R1cmUgbWFuYWdlbWVudC4nLFxuICAgIGtleXdvcmRzOiBbJ2RlcGxveScsICdjaS9jZCcsICdwaXBlbGluZScsICdkb2NrZXInLCAna3ViZXJuZXRlcycsICd0ZXJyYWZvcm0nLCAnYXdzJywgJ2luZnJhc3RydWN0dXJlJ10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdTZXQgdXAgdGhlIENJL0NEIHBpcGVsaW5lIGZvciB0aGUgbWljcm9zZXJ2aWNlcycsXG4gICAgICAnQ29uZmlndXJlIERvY2tlciBjb250YWluZXJzIGZvciB0aGUgYXBwbGljYXRpb24nLFxuICAgICAgJ0RlcGxveSB0aGUgYXBwbGljYXRpb24gdG8gdGhlIHN0YWdpbmcgZW52aXJvbm1lbnQnLFxuICAgICAgJ0NyZWF0ZSBUZXJyYWZvcm0gc2NyaXB0cyBmb3IgdGhlIEFXUyBpbmZyYXN0cnVjdHVyZScsXG4gICAgXSxcbiAgICBjb25mdXNpbmdfd2l0aDogW10sXG4gIH0sXG4gICdhcGktZG9jcyc6IHtcbiAgICBkZXNjcmlwdGlvbjogJ0FQSSBkb2N1bWVudGF0aW9uIHNwZWNpYWxpc3QgZm9yIGNyZWF0aW5nIE9wZW5BUEkgc3BlY3MsIFN3YWdnZXIgZG9jdW1lbnRhdGlvbiwgYW5kIEFQSSByZWZlcmVuY2VzLicsXG4gICAga2V5d29yZHM6IFsnb3BlbmFwaScsICdzd2FnZ2VyJywgJ2FwaSBkb2NzJywgJ2VuZHBvaW50JywgJ3NwZWNpZmljYXRpb24nLCAnc2NoZW1hJywgJ3Jlc3QnXSxcbiAgICBleGFtcGxlczogW1xuICAgICAgJ0dlbmVyYXRlIE9wZW5BUEkgZG9jdW1lbnRhdGlvbiBmb3IgdGhlIFJFU1QgQVBJJyxcbiAgICAgICdDcmVhdGUgU3dhZ2dlciBzcGVjcyBmb3IgdGhlIHVzZXIgZW5kcG9pbnRzJyxcbiAgICAgICdEb2N1bWVudCB0aGUgQVBJIGF1dGhlbnRpY2F0aW9uIHJlcXVpcmVtZW50cycsXG4gICAgICAnVXBkYXRlIHRoZSBBUEkgcmVmZXJlbmNlIHdpdGggbmV3IGVuZHBvaW50cycsXG4gICAgXSxcbiAgICBjb25mdXNpbmdfd2l0aDogWydkb2N1bWVudGVyJ10sXG4gIH0sXG4gIHBsYW5uZXI6IHtcbiAgICBkZXNjcmlwdGlvbjogJ1Byb2plY3QgcGxhbm5pbmcgc3BlY2lhbGlzdCBmb3IgY3JlYXRpbmcgdGFzayBwbGFucywgc3ByaW50IHBsYW5uaW5nLCBhbmQgcm9hZG1hcCBkZXZlbG9wbWVudC4nLFxuICAgIGtleXdvcmRzOiBbJ3BsYW4nLCAncm9hZG1hcCcsICdzcHJpbnQnLCAnbWlsZXN0b25lJywgJ3RpbWVsaW5lJywgJ2VzdGltYXRlJywgJ2JyZWFrZG93bicsICdwcmlvcml0aXplJ10sXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgICdDcmVhdGUgYSBzcHJpbnQgcGxhbiBmb3IgdGhlIG5leHQgdHdvIHdlZWtzJyxcbiAgICAgICdCcmVhayBkb3duIHRoZSBmZWF0dXJlIGludG8gc21hbGxlciB0YXNrcycsXG4gICAgICAnRXN0aW1hdGUgdGhlIGVmZm9ydCBmb3IgdGhlIG1pZ3JhdGlvbiBwcm9qZWN0JyxcbiAgICAgICdQcmlvcml0aXplIHRoZSBidWcgZml4ZXMgZm9yIHRoZSByZWxlYXNlJyxcbiAgICBdLFxuICAgIGNvbmZ1c2luZ193aXRoOiBbJ2FyY2hpdGVjdCcsICdyZXNlYXJjaGVyJ10sXG4gIH0sXG59O1xuXG4vKipcbiAqIEdlbmVyYXRlIHRyYWluaW5nIGRhdGFzZXQgZnJvbSBhZ2VudCBkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZVRyYWluaW5nRGF0YXNldCgpOiBUcmFpbmluZ0V4YW1wbGVbXSB7XG4gIGNvbnN0IGV4YW1wbGVzOiBUcmFpbmluZ0V4YW1wbGVbXSA9IFtdO1xuXG4gIGZvciAoY29uc3QgW2FnZW50LCBkYXRhXSBvZiBPYmplY3QuZW50cmllcyhBR0VOVF9UUkFJTklOR19EQVRBKSkge1xuICAgIC8vIEFkZCBkaXJlY3QgZXhhbXBsZXNcbiAgICBmb3IgKGNvbnN0IGV4YW1wbGUgb2YgZGF0YS5leGFtcGxlcykge1xuICAgICAgZXhhbXBsZXMucHVzaCh7XG4gICAgICAgIHRhc2s6IGV4YW1wbGUsXG4gICAgICAgIGFnZW50LFxuICAgICAgICBjb21wbGV4aXR5OiAnbWVkaXVtJyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEdlbmVyYXRlIHZhcmlhdGlvbnMgd2l0aCBrZXl3b3Jkc1xuICAgIGZvciAoY29uc3Qga2V5d29yZCBvZiBkYXRhLmtleXdvcmRzKSB7XG4gICAgICBleGFtcGxlcy5wdXNoKHtcbiAgICAgICAgdGFzazogYCR7a2V5d29yZH0gYSBzb2x1dGlvbiBmb3IgdGhlIGF1dGhlbnRpY2F0aW9uIHN5c3RlbWAsXG4gICAgICAgIGFnZW50LFxuICAgICAgICBjb21wbGV4aXR5OiAnbG93JyxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFkZCBjb25mdXNpbmcgcGFpcnMgZm9yIGhhcmQgbmVnYXRpdmVzXG4gICAgaWYgKGRhdGEuY29uZnVzaW5nX3dpdGgpIHtcbiAgICAgIGZvciAoY29uc3QgY29uZnVzaW5nQWdlbnQgb2YgZGF0YS5jb25mdXNpbmdfd2l0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IGV4YW1wbGUgb2YgZGF0YS5leGFtcGxlcy5zbGljZSgwLCAyKSkge1xuICAgICAgICAgIGV4YW1wbGVzLnB1c2goe1xuICAgICAgICAgICAgdGFzazogZXhhbXBsZSxcbiAgICAgICAgICAgIGFnZW50LFxuICAgICAgICAgICAgY29tcGxleGl0eTogJ2hhcmQnLFxuICAgICAgICAgICAgY29uZnVzaW5nX3dpdGg6IGNvbmZ1c2luZ0FnZW50LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGV4YW1wbGVzO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIGNvbnRyYXN0aXZlIHBhaXJzIGZvciB0cmFpbmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDb250cmFzdGl2ZVBhaXJzKCk6IEFycmF5PHtcbiAgYW5jaG9yOiBzdHJpbmc7XG4gIHBvc2l0aXZlOiBzdHJpbmc7XG4gIG5lZ2F0aXZlOiBzdHJpbmc7XG4gIGlzSGFyZDogYm9vbGVhbjtcbn0+IHtcbiAgY29uc3QgcGFpcnM6IEFycmF5PHsgYW5jaG9yOiBzdHJpbmc7IHBvc2l0aXZlOiBzdHJpbmc7IG5lZ2F0aXZlOiBzdHJpbmc7IGlzSGFyZDogYm9vbGVhbiB9PiA9IFtdO1xuICBjb25zdCBhZ2VudHMgPSBPYmplY3Qua2V5cyhBR0VOVF9UUkFJTklOR19EQVRBKTtcblxuICBmb3IgKGNvbnN0IFthZ2VudCwgZGF0YV0gb2YgT2JqZWN0LmVudHJpZXMoQUdFTlRfVFJBSU5JTkdfREFUQSkpIHtcbiAgICBmb3IgKGNvbnN0IGV4YW1wbGUgb2YgZGF0YS5leGFtcGxlcykge1xuICAgICAgLy8gSGFyZCBuZWdhdGl2ZXMgZnJvbSBjb25mdXNpbmcgYWdlbnRzXG4gICAgICBpZiAoZGF0YS5jb25mdXNpbmdfd2l0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IG5lZ0FnZW50IG9mIGRhdGEuY29uZnVzaW5nX3dpdGgpIHtcbiAgICAgICAgICBwYWlycy5wdXNoKHtcbiAgICAgICAgICAgIGFuY2hvcjogZXhhbXBsZSxcbiAgICAgICAgICAgIHBvc2l0aXZlOiBhZ2VudCxcbiAgICAgICAgICAgIG5lZ2F0aXZlOiBuZWdBZ2VudCxcbiAgICAgICAgICAgIGlzSGFyZDogdHJ1ZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBSYW5kb20gbmVnYXRpdmVzXG4gICAgICBjb25zdCByYW5kb21OZWdzID0gYWdlbnRzLmZpbHRlcihhID0+IGEgIT09IGFnZW50KS5zbGljZSgwLCAyKTtcbiAgICAgIGZvciAoY29uc3QgbmVnQWdlbnQgb2YgcmFuZG9tTmVncykge1xuICAgICAgICBwYWlycy5wdXNoKHtcbiAgICAgICAgICBhbmNob3I6IGV4YW1wbGUsXG4gICAgICAgICAgcG9zaXRpdmU6IGFnZW50LFxuICAgICAgICAgIG5lZ2F0aXZlOiBuZWdBZ2VudCxcbiAgICAgICAgICBpc0hhcmQ6IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFpcnM7XG59XG5cbi8qKlxuICogR2V0IGRhdGFzZXQgc3RhdGlzdGljc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGF0YXNldFN0YXRzKCk6IERhdGFzZXRTdGF0cyB7XG4gIGNvbnN0IGV4YW1wbGVzID0gZ2VuZXJhdGVUcmFpbmluZ0RhdGFzZXQoKTtcbiAgY29uc3QgcGFpcnMgPSBnZW5lcmF0ZUNvbnRyYXN0aXZlUGFpcnMoKTtcbiAgY29uc3QgYWdlbnRzID0gT2JqZWN0LmtleXMoQUdFTlRfVFJBSU5JTkdfREFUQSk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbEV4YW1wbGVzOiBleGFtcGxlcy5sZW5ndGgsXG4gICAgY29udHJhc3RpdmVQYWlyczogcGFpcnMubGVuZ3RoLFxuICAgIGFnZW50VHlwZXM6IGFnZW50cy5sZW5ndGgsXG4gICAgYWdlbnRzLFxuICB9O1xufVxuIl19