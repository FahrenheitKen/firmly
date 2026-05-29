/**
 * RVFA Distribution & Hot-Patch Module
 *
 * IPFS publishing of RVFA appliances via Pinata and RVFP binary patches
 * for section-level hot updates with atomic rollback.
 *
 * RVFP layout: [4B "RVFP"] [4B version u32LE] [4B header_len u32LE]
 *              [header JSON] [new section data] [32B SHA256 footer]
 */
export interface RvfpHeader {
    magic: 'RVFP';
    version: number;
    targetApplianceName: string;
    targetApplianceVersion: string;
    targetSection: string;
    patchVersion: string;
    created: string;
    newSectionSize: number;
    newSectionSha256: string;
    compression: 'none' | 'gzip';
    signature?: string;
    signedBy?: string;
}
export interface CreatePatchOptions {
    targetName: string;
    targetVersion: string;
    sectionId: string;
    sectionData: Buffer;
    patchVersion: string;
    compression?: 'none' | 'gzip';
    privateKey?: Buffer;
    signedBy?: string;
}
export interface ApplyOptions {
    backup?: boolean;
    verify?: boolean;
    publicKey?: Buffer;
}
export interface ApplyResult {
    success: boolean;
    backupPath?: string;
    newSize: number;
    patchedSection: string;
    errors: string[];
}
export interface PatchVerifyResult {
    valid: boolean;
    header: RvfpHeader;
    errors: string[];
}
export interface PublishConfig {
    pinataJwt?: string;
    gatewayUrl?: string;
    apiUrl?: string;
}
export interface PublishMetadata {
    name?: string;
    description?: string;
    version?: string;
    profile?: string;
}
export interface PublishResult {
    cid: string;
    size: number;
    gatewayUrl: string;
    pinataUrl: string;
}
export interface PublishedItem {
    cid: string;
    name: string;
    size: number;
    date: string;
}
export declare class RvfaPatcher {
    static createPatch(opts: CreatePatchOptions): Promise<Buffer>;
    static parsePatchHeader(buf: Buffer): RvfpHeader;
    static verifyPatch(buf: Buffer): Promise<PatchVerifyResult>;
    static applyPatch(rvfaPath: string, patchBuf: Buffer, opts?: ApplyOptions): Promise<ApplyResult>;
}
export declare class RvfaPublisher {
    private jwt;
    private gw;
    private api;
    constructor(config: PublishConfig);
    private upload;
    publish(rvfaPath: string, meta?: PublishMetadata): Promise<PublishResult>;
    publishPatch(patchBuf: Buffer, meta?: PublishMetadata): Promise<PublishResult>;
    fetch(cid: string, outputPath: string): Promise<void>;
    list(): Promise<PublishedItem[]>;
    pin(cid: string, name?: string): Promise<void>;
}
export declare function createPublisher(config?: Partial<PublishConfig>): RvfaPublisher;
export declare function createAndVerifyPatch(options: CreatePatchOptions): Promise<{
    patch: Buffer;
    verification: PatchVerifyResult;
}>;
//# sourceMappingURL=rvfa-distribution.d.ts.map