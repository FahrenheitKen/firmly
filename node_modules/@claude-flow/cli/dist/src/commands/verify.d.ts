/**
 * V3 CLI Verify Command
 *
 * Fetches the verification.md.json witness manifest from the live repo,
 * recomputes SHA-256 of every cited file in the user's installed
 * artifact, re-derives the Ed25519 public key from the manifest's git
 * commit, and verifies the signature.
 *
 * Run via: ruflo verify [--branch <branch>] [--manifest <local-path>]
 *
 * If everything checks, the user has byte-for-byte the same fix
 * footprint as the manifest claims. If anything mismatches, the
 * command exits non-zero and prints which fix regressed or which file
 * drifted.
 */
import type { Command } from '../types.js';
export declare const verifyCommand: Command;
export default verifyCommand;
//# sourceMappingURL=verify.d.ts.map