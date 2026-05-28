<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaxRateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rates = TaxRate::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->orderBy('name')
            ->get(['id', 'name', 'amount', 'is_active']);

        return response()->json(['tax_rates' => $rates]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0|max:100',
        ]);

        $validated['business_id'] = $request->user()->business_id;
        $validated['location_id'] = $request->user()->active_location_id;

        $rate = TaxRate::create($validated);

        return response()->json(['tax_rate' => $rate], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $rate = TaxRate::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'amount' => 'sometimes|required|numeric|min:0|max:100',
            'is_active' => 'nullable|boolean',
        ]);

        $rate->update($validated);

        return response()->json(['tax_rate' => $rate->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $rate = TaxRate::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);
        $rate->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
