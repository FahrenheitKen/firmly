<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OpposingCounsel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OpposingCounselController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (!$request->user()->canViewAnyCase()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $list = OpposingCounsel::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->with(['cases:id,opposing_counsel_id,our_reference,title,status'])
            ->orderBy('name')
            ->get(['id', 'name', 'firm', 'phone', 'email']);

        return response()->json(['opposing_counsels' => $list]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name'  => 'nullable|string|max:255',
            'firm'  => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
        ]);

        if (empty($validated['name']) && empty($validated['firm'])) {
            return response()->json(['errors' => ['name' => ['Please provide a name or firm.']]], 422);
        }

        $validated['name'] = $validated['name'] ?: ($validated['firm'] ?? '');
        $validated['business_id'] = $request->user()->business_id;
        $validated['location_id'] = $request->user()->active_location_id;

        $oc = OpposingCounsel::create($validated);

        return response()->json(['opposing_counsel' => $oc], 201);
    }
}
