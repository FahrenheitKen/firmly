<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\CacheTenantGet;
use App\Models\BusinessLocation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;

class BusinessLocationController extends Controller
{
    private function canManageBranches(Request $request): bool
    {
        $u = $request->user();
        return $u->isOwner()
            || $u->hasPermissionSafe('business_settings.access')
            || $u->hasPermissionSafe('business_settings.firm_branches');
    }

    public function index(Request $request): JsonResponse
    {
        $businessId = $request->user()->business_id;
        $user = $request->user();

        $query = BusinessLocation::where('business_id', $businessId)
            ->withCount(['users', 'clients', 'cases']);

        $permitted = $user->permittedLocations();
        $query->whereIn('id', $permitted);

        $locations = $query->get();

        return response()->json(['locations' => $locations]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->canManageBranches($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;

        $validated = $request->validate([
            'name' => 'required|string|max:256',
            'location_id' => 'nullable|string|max:50|unique:business_locations,location_id,NULL,id,business_id,' . $businessId,
            'landmark' => 'nullable|string',
            'country' => 'required|string|max:100',

            'city' => 'required|string|max:100',
            'zip_code' => 'required|string|max:10',
            'mobile' => 'nullable|string',
            'alternate_number' => 'nullable|string',
            'email' => 'nullable|email',
            'website' => 'nullable|string',
            'custom_field1' => 'nullable|string',
            'custom_field2' => 'nullable|string',
            'custom_field3' => 'nullable|string',
            'custom_field4' => 'nullable|string',
            'default_payment_accounts' => 'nullable|array',
            'featured_products' => 'nullable|array',
        ]);

        $validated['business_id'] = $businessId;
        if (empty($validated['location_id'])) {
            $validated['location_id'] = null;
        }

        $location = BusinessLocation::create($validated);

        $perm = Permission::firstOrCreate([
            'name' => "location.{$location->id}",
            'guard_name' => 'web',
        ]);
        $request->user()->givePermissionTo($perm);

        CacheTenantGet::flushTag('locations', $businessId);

        return response()->json([
            'location' => $location,
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $location = BusinessLocation::where('business_id', $request->user()->business_id)
            ->findOrFail($id);

        return response()->json(['location' => $location]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$this->canManageBranches($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;
        $location = BusinessLocation::where('business_id', $businessId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:256',
            'location_id' => 'nullable|string|max:50|unique:business_locations,location_id,' . $id . ',id,business_id,' . $businessId,
            'landmark' => 'nullable|string',
            'country' => 'sometimes|string|max:100',

            'city' => 'sometimes|string|max:100',
            'zip_code' => 'sometimes|string|max:10',
            'mobile' => 'nullable|string',
            'alternate_number' => 'nullable|string',
            'email' => 'nullable|email',
            'website' => 'nullable|string',
            'custom_field1' => 'nullable|string',
            'custom_field2' => 'nullable|string',
            'custom_field3' => 'nullable|string',
            'custom_field4' => 'nullable|string',
            'default_payment_accounts' => 'nullable|array',
            'featured_products' => 'nullable|array',
        ]);

        if (empty($validated['location_id'])) {
            $validated['location_id'] = null;
        }

        $location->update($validated);

        CacheTenantGet::flushTag('locations', $businessId);

        return response()->json([
            'location' => $location->fresh(),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$this->canManageBranches($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;
        $location = BusinessLocation::where('business_id', $businessId)->findOrFail($id);

        $activeCount = BusinessLocation::where('business_id', $businessId)
            ->where('is_active', true)
            ->count();

        if ($activeCount <= 1 && $location->is_active) {
            return response()->json([
                'message' => 'Cannot delete the last active location. Create another location first.',
            ], 422);
        }

        $this->reassignUsersFromLocation($businessId, $id);

        Permission::where('name', "location.{$id}")->delete();
        app()->make(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

        $location->delete();

        CacheTenantGet::flushTag('locations', $businessId);

        return response()->json(['message' => 'Location deleted']);
    }

    public function toggleActive(Request $request, int $id): JsonResponse
    {
        if (!$this->canManageBranches($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;
        $location = BusinessLocation::where('business_id', $businessId)->findOrFail($id);

        if ($location->is_active) {
            $activeCount = BusinessLocation::where('business_id', $businessId)
                ->where('is_active', true)
                ->count();

            if ($activeCount <= 1) {
                return response()->json([
                    'message' => 'Cannot deactivate the last active location.',
                ], 422);
            }

            $this->reassignUsersFromLocation($businessId, $id);
        }

        $location->update(['is_active' => !$location->is_active]);
        $location->refresh();

        CacheTenantGet::flushTag('locations', $businessId);

        return response()->json(['location' => $location]);
    }

    private function reassignUsersFromLocation(int $businessId, int $locationId): void
    {
        $fallback = BusinessLocation::where('business_id', $businessId)
            ->where('id', '!=', $locationId)
            ->where('is_active', true)
            ->first();

        $fallbackId = $fallback?->id;

        User::where('business_id', $businessId)
            ->where('active_location_id', $locationId)
            ->update(['active_location_id' => $fallbackId]);
    }

    public function setActive(Request $request, int $id): JsonResponse
    {
        $location = BusinessLocation::where('business_id', $request->user()->business_id)->findOrFail($id);

        if (!$request->user()->canAccessLocation($id)) {
            abort(403, 'You do not have access to this location.');
        }

        $request->user()->update(['active_location_id' => $location->id]);
        $request->user()->load('activeLocation');

        return response()->json([
            'active_location' => $location->only(['id', 'name', 'city', 'country']),
            'user' => $request->user()->only(['id', 'active_location_id']),
        ]);
    }
}
