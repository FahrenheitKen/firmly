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
        $list = OpposingCounsel::where('business_id', $request->user()->business_id)
            ->orderBy('name')
            ->get(['id', 'name', 'firm', 'phone', 'email']);

        return response()->json(['opposing_counsels' => $list]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'  => 'required|string|max:255',
            'firm'  => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
        ]);

        $validated['business_id'] = $request->user()->business_id;

        $oc = OpposingCounsel::create($validated);

        return response()->json(['opposing_counsel' => $oc], 201);
    }
}
