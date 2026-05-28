<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class CacheTenantGet
{
    public function handle(Request $request, Closure $next, ?string $ttl = null, ?string $tag = null): Response
    {
        if (!in_array($request->method(), ['GET', 'HEAD'], true)) {
            return $next($request);
        }

        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        $seconds = (int) ($ttl ?? 300);
        $tagKey = $tag ?: 'tenant';

        $cacheKey = sprintf(
            'tenant:%d:%d:%s:%s?%s',
            $user->business_id,
            $user->active_location_id ?? 0,
            $tagKey,
            $request->path(),
            http_build_query($request->query())
        );

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return response($cached['body'], $cached['status'])
                ->withHeaders($cached['headers'])
                ->header('X-Cache', 'HIT');
        }

        $response = $next($request);

        if ($response->getStatusCode() === 200 && $request->method() === 'GET') {
            Cache::put($cacheKey, [
                'body' => $response->getContent(),
                'status' => $response->getStatusCode(),
                'headers' => [
                    'Content-Type' => $response->headers->get('Content-Type', 'application/json'),
                ],
            ], $seconds);

            $this->trackKey($tagKey, $user->business_id, $cacheKey, $seconds);
        }

        return $response->header('X-Cache', 'MISS');
    }

    private function trackKey(string $tag, int $businessId, string $key, int $ttl): void
    {
        $indexKey = "tenant:index:{$businessId}:{$tag}";
        $keys = Cache::get($indexKey, []);
        if (!in_array($key, $keys, true)) {
            $keys[] = $key;
            Cache::put($indexKey, $keys, max($ttl, 3600));
        }
    }

    public static function flushTag(string $tag, int $businessId): void
    {
        $indexKey = "tenant:index:{$businessId}:{$tag}";
        foreach ((array) Cache::get($indexKey, []) as $key) {
            Cache::forget($key);
        }
        Cache::forget($indexKey);
    }
}
