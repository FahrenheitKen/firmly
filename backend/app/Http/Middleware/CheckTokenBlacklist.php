<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Symfony\Component\HttpFoundation\Response;

class CheckTokenBlacklist
{
    public function handle(Request $request, Closure $next): Response
    {
        $bearerToken = $request->bearerToken();

        if ($bearerToken) {
            $hash = hash('sha256', $bearerToken);
            if (Redis::exists("token:blacklist:{$hash}")) {
                return response()->json(['message' => 'Token has been revoked.'], 401);
            }
        }

        return $next($request);
    }
}
