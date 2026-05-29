/**
 * ADR-121 Phase 21 — embed cache tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { EmbedCache, wrapWithCache, canonicalizeText } from '../embed-cache.js';

function vec(values: number[]): Float32Array {
  return new Float32Array(values);
}

describe('canonicalizeText', () => {
  it('lowercases', () => {
    expect(canonicalizeText('HELLO World')).toBe('hello world');
  });
  it('trims', () => {
    expect(canonicalizeText('  hello  ')).toBe('hello');
  });
  it('collapses internal whitespace', () => {
    expect(canonicalizeText('hello   world')).toBe('hello world');
  });
  it('produces identical output for case + spacing variants', () => {
    expect(canonicalizeText('How does AUTH work?')).toBe(canonicalizeText('  how  does  auth  work?  '));
  });
});

describe('EmbedCache — basic shape', () => {
  it('throws on bad maxEntries', () => {
    expect(() => new EmbedCache({ maxEntries: 0 })).toThrow();
    expect(() => new EmbedCache({ maxEntries: -1 })).toThrow();
  });

  it('miss before any set', () => {
    const c = new EmbedCache();
    expect(c.get('hello')).toBeUndefined();
    expect(c.stats().misses).toBe(1);
    expect(c.stats().hits).toBe(0);
  });

  it('set then get returns the same vector', () => {
    const c = new EmbedCache();
    c.set('hello', vec([1, 2, 3]));
    const got = c.get('hello');
    expect(got).toBeDefined();
    expect(Array.from(got!)).toEqual([1, 2, 3]);
  });

  it('hit increments hits counter', () => {
    const c = new EmbedCache();
    c.set('hello', vec([1, 2, 3]));
    c.get('hello');
    c.get('hello');
    expect(c.stats().hits).toBe(2);
    expect(c.stats().misses).toBe(0);
    expect(c.stats().hitRate).toBeCloseTo(1, 6);
  });

  it('case + spacing variants hit the same entry', () => {
    const c = new EmbedCache();
    c.set('Hello World', vec([1, 2, 3]));
    expect(c.get('hello world')).toBeDefined();
    expect(c.get('  HELLO   WORLD  ')).toBeDefined();
  });

  it('different dims throw on set after the first', () => {
    const c = new EmbedCache();
    c.set('a', vec([1, 2, 3]));
    expect(() => c.set('b', vec([1, 2]))).toThrow(/dim/);
  });

  it('has() reports presence correctly', () => {
    const c = new EmbedCache();
    expect(c.has('x')).toBe(false);
    c.set('x', vec([1]));
    expect(c.has('x')).toBe(true);
    expect(c.has('y')).toBe(false);
  });

  it('reset() clears entries + stats', () => {
    const c = new EmbedCache();
    c.set('a', vec([1, 2]));
    c.get('a');
    c.reset();
    expect(c.stats().entries).toBe(0);
    expect(c.stats().hits).toBe(0);
    expect(c.stats().misses).toBe(0);
  });
});

describe('EmbedCache — LRU eviction', () => {
  it('evicts least-recently-used when over capacity', () => {
    const c = new EmbedCache({ maxEntries: 2 });
    c.set('a', vec([1]));
    c.set('b', vec([2]));
    c.set('c', vec([3])); // should evict 'a' (oldest)
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
    expect(c.has('c')).toBe(true);
  });

  it('get() bumps an entry to most-recent', () => {
    const c = new EmbedCache({ maxEntries: 2 });
    c.set('a', vec([1]));
    c.set('b', vec([2]));
    c.get('a'); // bump 'a' to MRU
    c.set('c', vec([3])); // evict 'b' (now oldest), keep 'a'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
    expect(c.has('c')).toBe(true);
  });

  it('re-setting an existing key bumps to MRU', () => {
    const c = new EmbedCache({ maxEntries: 2 });
    c.set('a', vec([1]));
    c.set('b', vec([2]));
    c.set('a', vec([99])); // overwrite + bump
    c.set('c', vec([3])); // evict 'b'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
    expect(c.has('c')).toBe(true);
    expect(Array.from(c.get('a')!)).toEqual([99]);
  });

  it('stats track entries + hit rate', () => {
    const c = new EmbedCache({ maxEntries: 5 });
    c.set('a', vec([1, 2, 3]));
    c.set('b', vec([4, 5, 6]));
    c.get('a');
    c.get('a');
    c.get('missing');
    const s = c.stats();
    expect(s.entries).toBe(2);
    expect(s.hits).toBe(2);
    expect(s.misses).toBe(1);
    expect(s.hitRate).toBeCloseTo(2 / 3, 6);
    expect(s.approxByteSize).toBe(2 * 3 * 4); // 2 vecs × dim 3 × 4 bytes
  });
});

describe('EmbedCache — sha256 keying', () => {
  it('produces a 64-char hex key', () => {
    const c = new EmbedCache();
    expect(c.keyFor('hello', 384)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different dims for same text produce different keys', () => {
    const c = new EmbedCache();
    expect(c.keyFor('hello', 128)).not.toBe(c.keyFor('hello', 384));
  });

  it('different text produces different keys', () => {
    const c = new EmbedCache();
    expect(c.keyFor('hello', 384)).not.toBe(c.keyFor('world', 384));
  });
});

describe('wrapWithCache', () => {
  it('calls the wrapped embedder on miss', async () => {
    const embedSpy = vi.fn(async (_text: string) => vec([1, 2, 3]));
    const cache = new EmbedCache();
    const wrapped = wrapWithCache(embedSpy, cache);
    const result = await wrapped('hello');
    expect(Array.from(result)).toEqual([1, 2, 3]);
    expect(embedSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call the wrapped embedder on hit', async () => {
    const embedSpy = vi.fn(async (_text: string) => vec([1, 2, 3]));
    const cache = new EmbedCache();
    const wrapped = wrapWithCache(embedSpy, cache);
    await wrapped('hello'); // miss → calls embedder
    await wrapped('hello'); // hit → does NOT call embedder
    expect(embedSpy).toHaveBeenCalledTimes(1);
  });

  it('cache hit rate reflects repeated calls', async () => {
    const embedSpy = vi.fn(async (text: string) => vec([text.length]));
    const cache = new EmbedCache();
    const wrapped = wrapWithCache(embedSpy, cache);
    await wrapped('a');
    await wrapped('a');
    await wrapped('a');
    await wrapped('b');
    expect(embedSpy).toHaveBeenCalledTimes(2); // 'a' once, 'b' once
    expect(cache.stats().hits).toBe(2);
    expect(cache.stats().misses).toBe(2);
    expect(cache.stats().hitRate).toBe(0.5);
  });

  it('case + spacing variants hit the same cached vector', async () => {
    const embedSpy = vi.fn(async (text: string) => vec([text.length]));
    const cache = new EmbedCache();
    const wrapped = wrapWithCache(embedSpy, cache);
    await wrapped('Hello World');
    await wrapped('  HELLO   WORLD  ');
    expect(embedSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts number[] from the embedder and converts to Float32Array', async () => {
    const embedSpy = vi.fn(async (_text: string) => [1, 2, 3] as number[]);
    const cache = new EmbedCache();
    const wrapped = wrapWithCache(embedSpy, cache);
    const result = await wrapped('hello');
    expect(result).toBeInstanceOf(Float32Array);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });
});
