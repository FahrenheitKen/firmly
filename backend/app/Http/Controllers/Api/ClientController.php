<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $businessId = $request->user()->business_id;
        $activeLocationId = $request->user()->active_location_id;

        $clients = Client::where('business_id', $businessId)
            ->where('location_id', $activeLocationId)
            ->when($request->search, fn($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('first_name', 'like', "%{$s}%")
                  ->orWhere('last_name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('phone', 'like', "%{$s}%")
                  ->orWhere('business_name', 'like', "%{$s}%")
                  ->orWhere('client_id', 'like', "%{$s}%");
            }))
            ->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->query('per_page', 20), 500));

        return response()->json([
            'clients' => $clients->items(),
            'pagination' => [
                'current_page' => $clients->currentPage(),
                'last_page' => $clients->lastPage(),
                'per_page' => $clients->perPage(),
                'total' => $clients->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('client.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;
        $locationId = $request->user()->active_location_id;

        $validated = $request->validate([
            'client_type' => 'required|in:individual,business',
            'client_id' => 'nullable|string|max:50|unique:clients,client_id',
            'prefix' => 'nullable|string|max:20',
            'first_name' => 'required_if:client_type,individual|nullable|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'business_name' => 'required_if:client_type,business|nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'required|string|max:50',
            'alternative_contact' => 'nullable|string|max:50',
            'tax_number' => 'nullable|string|max:50',
            'opening_balance' => 'nullable|numeric|min:0',
            'address' => 'nullable|string',
            'street' => 'nullable|string|max:255',
            'building' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'zip_code' => 'nullable|string|max:20',
        ]);

        if (empty($validated['phone']) && empty($validated['email'])) {
            $validated['business_id'] = $businessId;
            $validated['location_id'] = $locationId;
            if (empty($validated['client_id'])) {
                $validated['client_id'] = 'CLT-' . strtoupper(Str::random(6));
            }
            $client = Client::create($validated);
            return response()->json(['client' => $client], 201);
        }

        $existing = null;
        if (!empty($validated['phone'])) {
            $existing = Client::where('business_id', $businessId)
                ->where('location_id', $locationId)
                ->where('phone', $validated['phone'])
                ->first();
        }
        if (!$existing && !empty($validated['email'])) {
            $existing = Client::where('business_id', $businessId)
                ->where('location_id', $locationId)
                ->where('email', $validated['email'])
                ->first();
        }

        if ($existing) {
            return response()->json(['message' => 'A client with this phone or email already exists in this branch'], 422);
        }

        if (empty($validated['client_id'])) {
            $validated['client_id'] = 'CLT-' . strtoupper(Str::random(6));
        }

        $validated['business_id'] = $businessId;
        $validated['location_id'] = $locationId;

        $client = Client::create($validated);

        return response()->json(['client' => $client], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $client = Client::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);
        return response()->json(['client' => $client]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('client.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $client = Client::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'client_type' => 'sometimes|in:individual,business',
            'client_id' => 'nullable|string|max:50|unique:clients,client_id,' . $id,
            'prefix' => 'nullable|string|max:20',
            'first_name' => 'nullable|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'business_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'sometimes|required|string|max:50',
            'alternative_contact' => 'nullable|string|max:50',
            'tax_number' => 'nullable|string|max:50',
            'opening_balance' => 'nullable|numeric|min:0',
            'address' => 'nullable|string',
            'street' => 'nullable|string|max:255',
            'building' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'zip_code' => 'nullable|string|max:20',
        ]);

        $client->update($validated);

        return response()->json(['client' => $client]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('client.delete')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $client = Client::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);
        $client->delete();

        return response()->json(['message' => 'Client deleted']);
    }

    public function toggleActive(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('client.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $client = Client::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);
        $client->update(['is_active' => !$client->is_active]);
        $client->refresh();

        return response()->json(['client' => $client]);
    }
}
