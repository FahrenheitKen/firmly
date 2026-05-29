/**
 * RVFA Distribution & Hot-Patch Module
 *
 * IPFS publishing of RVFA appliances via Pinata and RVFP binary patches
 * for section-level hot updates with atomic rollback.
 *
 * RVFP layout: [4B "RVFP"] [4B version u32LE] [4B header_len u32LE]
 *              [header JSON] [new section data] [32B SHA256 footer]
 */
import { createHash, sign, verify as edVerify } from 'node:crypto';
import { readFile, writeFile, rename, unlink, copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { request as httpsRequest } from 'node:https';
import { gzipSync, gunzipSync } from 'node:zlib';
import { RvfaReader, RvfaWriter } from './rvfa-format.js';
// ── Constants ────────────────────────────────────────────────
const RVFP_VERSION = 1;
const PRE = 12; // preamble: 4 magic + 4 version + 4 header_len
const SHA_LEN = 32;
const DEFAULT_GW = 'https://gateway.pinata.cloud';
const DEFAULT_API = 'https://api.pinata.cloud';
// ── Crypto helpers ───────────────────────────────────────────
function sha256(d) { return createHash('sha256').update(d).digest('hex'); }
function sha256B(d) { return createHash('sha256').update(d).digest(); }
function detectKeyFormat(key) {
    const str = key.toString('utf-8');
    if (str.includes('BEGIN PRIVATE KEY'))
        return { format: 'pem', type: 'pkcs8' };
    if (str.includes('BEGIN PUBLIC KEY'))
        return { format: 'pem', type: 'spki' };
    // Heuristic: DER-encoded keys are raw binary, never valid UTF-8 "BEGIN"
    return { format: 'der', type: 'pkcs8' }; // caller must override type for public keys
}
function edSign(data, key) {
    const det = detectKeyFormat(key);
    return sign(null, data, { key, format: det.format, type: det.type }).toString('hex');
}
function edCheck(data, sig, key) {
    try {
        const det = detectKeyFormat(key);
        const type = det.format === 'pem' ? det.type : 'spki'; // public key for verify
        return edVerify(null, data, { key, format: det.format, type }, Buffer.from(sig, 'hex'));
    }
    catch {
        return false;
    }
}
// ── HTTP helpers ─────────────────────────────────────────────
function pinataReq(method, path, jwt, body, ct) {
    return new Promise((resolve, reject) => {
        const u = new URL(path);
        const h = { Authorization: `Bearer ${jwt}` };
        if (ct)
            h['Content-Type'] = ct;
        if (body)
            h['Content-Length'] = String(body.length);
        const req = httpsRequest({ hostname: u.hostname, path: u.pathname + u.search, method, headers: h }, (res) => {
            const ch = [];
            res.on('data', (c) => ch.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(ch);
                let data;
                try {
                    data = JSON.parse(raw.toString('utf-8'));
                }
                catch {
                    data = raw;
                }
                resolve({ status: res.statusCode ?? 0, data });
            });
        });
        req.setTimeout(30_000, () => { req.destroy(new Error('Request timed out after 30s')); });
        req.on('error', reject);
        if (body)
            req.write(body);
        req.end();
    });
}
function httpGet(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0)
            return reject(new Error('Too many redirects'));
        const u = new URL(url);
        const req = httpsRequest({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET' }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return void httpGet(res.headers.location, maxRedirects - 1).then(resolve, reject);
            }
            const ch = [];
            res.on('data', (c) => ch.push(c));
            res.on('end', () => resolve(Buffer.concat(ch)));
        });
        req.setTimeout(30_000, () => { req.destroy(new Error('Request timed out after 30s')); });
        req.on('error', reject);
        req.end();
    });
}
function multipart(name, file, data, meta) {
    const b = `----Rvfa${Date.now()}${Math.random().toString(36).slice(2)}`;
    const parts = [];
    if (meta) {
        parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="pinataMetadata"\r\n` +
            `Content-Type: application/json\r\n\r\n${meta}\r\n`));
    }
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${name}"; filename="${file}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`));
    parts.push(data, Buffer.from(`\r\n--${b}--\r\n`));
    return { body: Buffer.concat(parts), ct: `multipart/form-data; boundary=${b}` };
}
/** Extract patch section data and bounds from a parsed patch buffer. */
function patchData(buf) {
    const hLen = buf.readUInt32LE(8);
    const start = PRE + hLen;
    const end = buf.length - SHA_LEN;
    return { start, end, section: buf.subarray(start, end) };
}
/** Canonical JSON: recursive key-sorting for deterministic serialization. */
function canonicalJson(value) {
    return JSON.stringify(value, (_key, val) => {
        if (val !== null && typeof val === 'object' && !Array.isArray(val) && !Buffer.isBuffer(val)) {
            const sorted = {};
            for (const k of Object.keys(val).sort()) {
                sorted[k] = val[k];
            }
            return sorted;
        }
        return val;
    });
}
/** Build a failed ApplyResult. */
function failResult(sec, errs, extra) {
    return { success: false, newSize: 0, patchedSection: sec, errors: errs, ...extra };
}
// ── RvfaPatcher ──────────────────────────────────────────────
export class RvfaPatcher {
    static async createPatch(opts) {
        const comp = opts.compression ?? 'none';
        const payload = comp === 'gzip' ? gzipSync(opts.sectionData) : opts.sectionData;
        const header = {
            magic: 'RVFP', version: RVFP_VERSION,
            targetApplianceName: opts.targetName, targetApplianceVersion: opts.targetVersion,
            targetSection: opts.sectionId, patchVersion: opts.patchVersion,
            created: new Date().toISOString(), newSectionSize: payload.length,
            newSectionSha256: sha256(payload), compression: comp,
        };
        if (opts.privateKey && opts.signedBy) {
            const signable = Buffer.concat([Buffer.from(canonicalJson(header), 'utf-8'), payload]);
            header.signature = edSign(signable, opts.privateKey);
            header.signedBy = opts.signedBy;
        }
        const hJson = Buffer.from(JSON.stringify(header), 'utf-8');
        const magic = Buffer.from('RVFP');
        const ver = Buffer.alloc(4);
        ver.writeUInt32LE(RVFP_VERSION, 0);
        const hLen = Buffer.alloc(4);
        hLen.writeUInt32LE(hJson.length, 0);
        return Buffer.concat([magic, ver, hLen, hJson, payload, sha256B(payload)]);
    }
    static parsePatchHeader(buf) {
        if (buf.length < PRE)
            throw new Error('Buffer too small for RVFP preamble');
        const magic = buf.subarray(0, 4).toString('ascii');
        if (magic !== 'RVFP')
            throw new Error(`Invalid RVFP magic: "${magic}"`);
        const ver = buf.readUInt32LE(4);
        if (ver !== RVFP_VERSION)
            throw new Error(`Unsupported RVFP version: ${ver}`);
        const hLen = buf.readUInt32LE(8);
        if (PRE + hLen > buf.length)
            throw new Error('Buffer too small for declared header');
        const h = JSON.parse(buf.subarray(PRE, PRE + hLen).toString('utf-8'));
        if (h.magic !== 'RVFP')
            throw new Error('RVFP header magic mismatch');
        return h;
    }
    static async verifyPatch(buf) {
        const errors = [];
        let header;
        try {
            header = RvfaPatcher.parsePatchHeader(buf);
        }
        catch (e) {
            const empty = {
                magic: 'RVFP', version: 0, targetApplianceName: '', targetApplianceVersion: '',
                targetSection: '', patchVersion: '', created: '', newSectionSize: 0,
                newSectionSha256: '', compression: 'none',
            };
            return { valid: false, header: empty, errors: [e.message] };
        }
        const { start, end, section } = patchData(buf);
        if (end < start) {
            errors.push('Patch too small: no room for section data and footer');
            return { valid: false, header, errors };
        }
        if (section.length !== header.newSectionSize)
            errors.push(`Size mismatch: header=${header.newSectionSize}, actual=${section.length}`);
        if (sha256(section) !== header.newSectionSha256)
            errors.push('Section SHA256 mismatch');
        if (!sha256B(section).equals(buf.subarray(buf.length - SHA_LEN)))
            errors.push('Footer SHA256 mismatch');
        return { valid: errors.length === 0, header, errors };
    }
    static async applyPatch(rvfaPath, patchBuf, opts) {
        const doBackup = opts?.backup ?? true;
        const doVerify = opts?.verify ?? true;
        // Parse & verify patch
        let header;
        try {
            header = RvfaPatcher.parsePatchHeader(patchBuf);
        }
        catch (e) {
            return failResult('', [e.message]);
        }
        const sec = header.targetSection;
        // Verify signature
        if (opts?.publicKey && header.signature) {
            const { section } = patchData(patchBuf);
            const unsigned = { ...header };
            delete unsigned.signature;
            delete unsigned.signedBy;
            const signable = Buffer.concat([Buffer.from(canonicalJson(unsigned), 'utf-8'), section]);
            if (!edCheck(signable, header.signature, opts.publicKey))
                return failResult(sec, ['Patch signature verification failed']);
        }
        // Verify patch integrity
        const check = await RvfaPatcher.verifyPatch(patchBuf);
        if (!check.valid)
            return failResult(sec, check.errors);
        // Read target RVFA
        let reader;
        try {
            reader = await RvfaReader.fromFile(rvfaPath);
        }
        catch (e) {
            return failResult(sec, [`Failed to read RVFA: ${e.message}`]);
        }
        const rh = reader.getHeader();
        // Verify target matches
        const errs = [];
        if (rh.name !== header.targetApplianceName)
            errs.push(`Name mismatch: patch="${header.targetApplianceName}", file="${rh.name}"`);
        if (rh.appVersion !== header.targetApplianceVersion)
            errs.push(`Version mismatch: patch="${header.targetApplianceVersion}", file="${rh.appVersion}"`);
        if (errs.length)
            return failResult(sec, errs);
        if (!rh.sections.find((s) => s.id === sec))
            return failResult(sec, [`Section "${sec}" not found in appliance`]);
        // Backup
        let backupPath;
        if (doBackup) {
            backupPath = rvfaPath + '.bak';
            await copyFile(rvfaPath, backupPath);
        }
        // Extract new section data from patch (decompress if needed)
        let newData = patchData(patchBuf).section;
        if (header.compression === 'gzip')
            newData = gunzipSync(newData);
        // Rebuild RVFA with replaced section
        const writer = new RvfaWriter({ ...rh, sections: [] });
        for (const s of rh.sections) {
            const comp = s.compression === 'zstd' ? 'gzip' : s.compression;
            if (s.id === sec) {
                writer.addSection(s.id, newData, { compression: comp, type: s.type });
            }
            else {
                writer.addSection(s.id, reader.extractSection(s.id), { compression: comp, type: s.type });
            }
        }
        const newRvfa = writer.build();
        // Atomic write (tmp + rename)
        const tmpPath = rvfaPath + `.tmp.${Date.now()}`;
        try {
            await writeFile(tmpPath, newRvfa);
            await rename(tmpPath, rvfaPath);
        }
        catch (e) {
            await unlink(tmpPath).catch(() => { });
            if (backupPath)
                await copyFile(backupPath, rvfaPath).catch(() => { });
            return failResult(sec, [`Atomic write failed: ${e.message}`], { backupPath });
        }
        // Post-patch verification with rollback
        if (doVerify) {
            try {
                const vr = await RvfaReader.fromFile(rvfaPath);
                const vResult = vr.verify();
                if (!vResult.valid) {
                    if (backupPath)
                        await copyFile(backupPath, rvfaPath).catch(() => { });
                    return failResult(sec, [`Post-patch verification failed: ${vResult.errors.join('; ')}`], { backupPath, newSize: newRvfa.length });
                }
            }
            catch (e) {
                if (backupPath)
                    await copyFile(backupPath, rvfaPath).catch(() => { });
                return failResult(sec, [`Post-patch verify error: ${e.message}`], { backupPath, newSize: newRvfa.length });
            }
        }
        return { success: true, backupPath, newSize: newRvfa.length, patchedSection: sec, errors: [] };
    }
}
// ── RvfaPublisher ────────────────────────────────────────────
export class RvfaPublisher {
    jwt;
    gw;
    api;
    constructor(config) {
        this.jwt = config.pinataJwt || process.env.PINATA_API_JWT || '';
        this.gw = (config.gatewayUrl || DEFAULT_GW).replace(/\/+$/, '');
        this.api = (config.apiUrl || DEFAULT_API).replace(/\/+$/, '');
        if (!this.jwt)
            throw new Error('Pinata JWT required (config.pinataJwt or PINATA_API_JWT)');
    }
    async upload(fileName, data, kv) {
        const meta = JSON.stringify({ name: fileName, keyvalues: kv });
        const { body, ct } = multipart('file', fileName, data, meta);
        const res = await pinataReq('POST', `${this.api}/pinning/pinFileToIPFS`, this.jwt, body, ct);
        if (res.status !== 200)
            throw new Error(`Pinata upload failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
        const r = res.data;
        return {
            cid: r.IpfsHash, size: r.PinSize,
            gatewayUrl: `${this.gw}/ipfs/${r.IpfsHash}`, pinataUrl: `${this.api}/pinning/pins/${r.IpfsHash}`,
        };
    }
    async publish(rvfaPath, meta) {
        const data = await readFile(rvfaPath);
        const name = meta?.name || rvfaPath.split('/').pop() || 'appliance.rvf';
        return this.upload(name, data, {
            type: 'rvfa-appliance', version: meta?.version || '',
            profile: meta?.profile || '', description: meta?.description || '',
        });
    }
    async publishPatch(patchBuf, meta) {
        const name = meta?.name || `patch-${Date.now()}.rvfp`;
        return this.upload(name, patchBuf, {
            type: 'rvfp-patch', version: meta?.version || '', description: meta?.description || '',
        });
    }
    async fetch(cid, outputPath) {
        const data = await httpGet(`${this.gw}/ipfs/${cid}`);
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, data);
    }
    async list() {
        const res = await pinataReq('GET', `${this.api}/data/pinList?status=pinned&pageLimit=100`, this.jwt);
        if (res.status !== 200)
            throw new Error(`Pinata list failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
        const d = res.data;
        return (d.rows || []).map((r) => ({
            cid: r.ipfs_pin_hash, name: r.metadata?.name || r.ipfs_pin_hash,
            size: r.size, date: r.date_pinned,
        }));
    }
    async pin(cid, name) {
        const body = Buffer.from(JSON.stringify({ hashToPin: cid, pinataMetadata: { name: name || cid } }));
        const res = await pinataReq('POST', `${this.api}/pinning/pinByHash`, this.jwt, body, 'application/json');
        if (res.status !== 200)
            throw new Error(`Pinata pin failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
    }
}
// ── Convenience exports ──────────────────────────────────────
export function createPublisher(config) {
    return new RvfaPublisher({ pinataJwt: config?.pinataJwt, gatewayUrl: config?.gatewayUrl, apiUrl: config?.apiUrl });
}
export async function createAndVerifyPatch(options) {
    const patch = await RvfaPatcher.createPatch(options);
    const verification = await RvfaPatcher.verifyPatch(patch);
    return { patch, verification };
}
//# sourceMappingURL=rvfa-distribution.js.map