<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\CacheTenantGet;
use App\Models\BusinessLocation;
use App\Models\User;
use App\Notifications\WelcomeUserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserManagementController extends Controller
{
    use \App\Traits\LogsActivity;

    public function index(Request $request): JsonResponse
    {
        $businessId = $request->user()->business_id;
        $activeLocationId = $request->user()->active_location_id;

        $users = User::where('business_id', $businessId)
            ->with('roles')
            ->when($activeLocationId, function ($q) use ($activeLocationId) {
                $q->where(function ($q) use ($activeLocationId) {
                    $q->whereDoesntHave('permissions', fn($p) => $p->where('name', 'like', 'location.%'))
                      ->orWhereHas('permissions', fn($p) => $p->where('name', "location.{$activeLocationId}"));
                });
            })
            ->when($request->search, fn($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('first_name', 'like', "%{$s}%")
                  ->orWhere('last_name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%");
            }))
            ->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->query('per_page', 25), 500));

        $items = collect($users->items())->map(function (User $u) {
            $data = $u->toArray();
            $data['full_name'] = $u->user_full_name;
            $data['role'] = $u->role_name;
            return $data;
        });

        return response()->json([
            'users' => $items,
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    private function canManageUsers(Request $request): bool
    {
        $user = $request->user();
        return $user->isOwner() || $user->hasPermissionSafe('user.create');
    }

    private function isAdminOrOwner(Request $request): bool
    {
        $user = $request->user();
        if ($user->isOwner()) return true;
        $businessId = $user->business_id;
        return $user->roles->contains(fn($r) => $r->name === "Admin#{$businessId}");
    }

    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('user.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;

        $validated = $request->validate([
            'surname' => 'nullable|string|max:10',
            'first_name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => 'required|email|unique:users',
            'role_id' => 'required|exists:roles,id,guard_name,web',
            'allow_login' => 'nullable|boolean',
            'contact_no' => 'nullable|string|max:20',
            'address' => 'nullable|string',
            'is_cmmsn_agnt' => 'nullable|boolean',
            'cmmsn_percent' => 'nullable|numeric|min:0|max:100',
            'max_sales_discount_percent' => 'nullable|numeric|min:0|max:100',
            'dob' => 'nullable|date',
            'gender' => 'nullable|string|in:male,female,other',
            'marital_status' => 'nullable|in:married,unmarried,divorced',
            'blood_group' => 'nullable|string|max:10',
            'language' => 'nullable|string|max:7',
            'location_permissions' => 'nullable|array',
            'location_permissions.*' => 'integer|exists:business_locations,id',
            'custom_field_1' => 'nullable|string',
            'custom_field_2' => 'nullable|string',
            'custom_field_3' => 'nullable|string',
            'custom_field_4' => 'nullable|string',
            'account_holder_name' => 'nullable|string|max:255',
            'account_number' => 'nullable|string|max:50',
            'bank_name' => 'nullable|string|max:255',
            'bank_identification_code' => 'nullable|string|max:50',
            'branch' => 'nullable|string|max:255',
            'tax_payer_id' => 'nullable|string|max:50',
            'basic_salary' => 'nullable|numeric|min:0',
        ]);

        $bankFieldKeys = ['account_holder_name', 'account_number', 'bank_name', 'bank_identification_code', 'branch', 'tax_payer_id', 'basic_salary'];
        $bankDetails = array_filter(
            array_intersect_key($validated, array_flip($bankFieldKeys)),
            fn($v) => $v !== null && $v !== ''
        );
        $validated = array_diff_key($validated, array_flip($bankFieldKeys));
        $roleId = $validated['role_id'] ?? null;
        $locationPerms = $validated['location_permissions'] ?? null;
        unset($validated['role_id'], $validated['location_permissions']);

        $temporaryPassword = Str::random(10);

        $user = User::create([
            'user_type' => 'user',
            'surname' => $validated['surname'] ?? null,
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'] ?? null,
            'email' => $validated['email'],
            'password' => $temporaryPassword,
            'must_change_password' => true,
            'business_id' => $businessId,
            'allow_login' => $validated['allow_login'] ?? true,
            'contact_no' => $validated['contact_no'] ?? null,
            'address' => $validated['address'] ?? null,
            'is_cmmsn_agnt' => $validated['is_cmmsn_agnt'] ?? false,
            'cmmsn_percent' => $validated['cmmsn_percent'] ?? 0,
            'max_sales_discount_percent' => $validated['max_sales_discount_percent'] ?? null,
            'dob' => $validated['dob'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'marital_status' => $validated['marital_status'] ?? null,
            'blood_group' => $validated['blood_group'] ?? null,
            'language' => $validated['language'] ?? 'en',
            'custom_field_1' => $validated['custom_field_1'] ?? null,
            'custom_field_2' => $validated['custom_field_2'] ?? null,
            'custom_field_3' => $validated['custom_field_3'] ?? null,
            'custom_field_4' => $validated['custom_field_4'] ?? null,
            'bank_details' => !empty($bankDetails) ? $bankDetails : null,
        ]);

        try {
            $role = Role::findById($roleId, 'web');
        } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
            return response()->json(['message' => 'Role not found.'], 404);
        }
        if (!str_ends_with($role->name, "#{$businessId}")) {
            return response()->json(['message' => 'Role does not belong to this business.'], 403);
        }
        $user->assignRole($role);

        if (!empty($locationPerms)) {
            $validLocations = BusinessLocation::where('business_id', $businessId)
                ->whereIn('id', $locationPerms)
                ->pluck('id')
                ->toArray();

            if (count($validLocations) !== count($locationPerms)) {
                return response()->json(['message' => 'One or more locations do not belong to this business.'], 422);
            }

            $this->assignLocationPermissions($user, $validLocations);
            $user->update(['active_location_id' => $validLocations[0]]);
        }

        $businessName = $request->user()->business->name ?? 'Firmly';
        $user->notify(new WelcomeUserNotification($temporaryPassword, $businessName));

        $this->logActivity($request, 'created', 'user', $user->id, trim($user->first_name . ' ' . ($user->last_name ?? '')));

        return response()->json([
            'user' => $user->load('roles'),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('user.view')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = User::where('business_id', $request->user()->business_id)
            ->with(['roles.permissions'])
            ->findOrFail($id);

        $user->makeVisible('bank_details');

        $locationPermissions = $user->permissions
            ->filter(fn($p) => str_starts_with($p->name, 'location.'))
            ->map(fn($p) => (int) str_replace('location.', '', $p->name))
            ->values()
            ->toArray();

        return response()->json([
            'user' => $user,
            'location_permissions' => $locationPermissions,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('user.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = User::where('business_id', $request->user()->business_id)->findOrFail($id);

        $validated = $request->validate([
            'surname' => 'nullable|string|max:10',
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|unique:users,email,' . $id,
            'role_id' => 'nullable|exists:roles,id,guard_name,web',
            'allow_login' => 'nullable|boolean',
            'contact_no' => 'nullable|string|max:20',
            'address' => 'nullable|string',
            'is_cmmsn_agnt' => 'nullable|boolean',
            'cmmsn_percent' => 'nullable|numeric|min:0|max:100',
            'max_sales_discount_percent' => 'nullable|numeric|min:0|max:100',
            'dob' => 'nullable|date',
            'gender' => 'nullable|string|in:male,female,other',
            'marital_status' => 'nullable|in:married,unmarried,divorced',
            'blood_group' => 'nullable|string|max:10',
            'language' => 'nullable|string|max:7',
            'location_permissions' => 'nullable|array',
            'location_permissions.*' => 'integer|exists:business_locations,id',
            'custom_field_1' => 'nullable|string',
            'custom_field_2' => 'nullable|string',
            'custom_field_3' => 'nullable|string',
            'custom_field_4' => 'nullable|string',
            'account_holder_name' => 'nullable|string|max:255',
            'account_number' => 'nullable|string|max:50',
            'bank_name' => 'nullable|string|max:255',
            'bank_identification_code' => 'nullable|string|max:50',
            'branch' => 'nullable|string|max:255',
            'tax_payer_id' => 'nullable|string|max:50',
            'basic_salary' => 'nullable|numeric|min:0',
        ]);

        $bankFieldKeys = ['account_holder_name', 'account_number', 'bank_name', 'bank_identification_code', 'branch', 'tax_payer_id', 'basic_salary'];
        $bankDetails = array_filter(
            array_intersect_key($validated, array_flip($bankFieldKeys)),
            fn($v) => $v !== null && $v !== ''
        );
        $validated = array_diff_key($validated, array_flip($bankFieldKeys));
        $validated['bank_details'] = !empty($bankDetails) ? $bankDetails : null;

        $roleId = $validated['role_id'] ?? null;
        $locationPerms = $validated['location_permissions'] ?? null;
        unset($validated['role_id'], $validated['location_permissions']);

        $user->update($validated);

        if ($roleId) {
            try {
                $role = Role::findById($roleId, 'web');
            } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
                return response()->json(['message' => 'Role not found.'], 404);
            }
            if (!str_ends_with($role->name, "#{$request->user()->business_id}")) {
                return response()->json(['message' => 'Role does not belong to this business.'], 403);
            }
            $user->syncRoles([$role]);
        }

        if ($locationPerms !== null) {
            $validLocations = BusinessLocation::where('business_id', $request->user()->business_id)
                ->whereIn('id', $locationPerms)
                ->pluck('id')
                ->toArray();

            if (count($validLocations) !== count($locationPerms)) {
                return response()->json(['message' => 'One or more locations do not belong to this business.'], 422);
            }

            $user->permissions()
                ->where('name', 'like', 'location.%')
                ->detach();
            $this->assignLocationPermissions($user, $validLocations);
            $user->update(['active_location_id' => !empty($validLocations) ? $validLocations[0] : null]);
        }

        return response()->json(['user' => $user->fresh(['roles.permissions'])->makeVisible('bank_details')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('user.delete')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = User::where('business_id', $request->user()->business_id)->findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete yourself'], 422);
        }

        $business = $user->business;
        if ($business && $business->owner_id === $user->id) {
            return response()->json(['message' => 'Cannot delete business owner'], 422);
        }

        $label = trim($user->first_name . ' ' . ($user->last_name ?? ''));
        $user->delete();

        $this->logActivity($request, 'deleted', 'user', $id, $label);

        return response()->json(['message' => 'User deleted']);
    }

    public function updatePassword(Request $request, int $id): JsonResponse
    {
        $user = User::where('business_id', $request->user()->business_id)->findOrFail($id);

        $businessId = $request->user()->business_id;
        $isAdmin = $request->user()->isOwner() || $request->user()->roles->contains(fn($r) => $r->name === "Admin#{$businessId}");
        if (!$isAdmin) {
            return response()->json(['message' => 'Only admins can reset passwords.'], 403);
        }

        $business = $user->business;
        if ($business && $business->owner_id === $user->id && !$request->user()->isOwner()) {
            return response()->json(['message' => 'Only the business owner can change the owner password.'], 403);
        }

        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($request->current_password, $request->user()->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update(['password' => $request->password]);

        return response()->json(['message' => 'Password updated']);
    }

    public function roles(Request $request): JsonResponse
    {
        $businessId = $request->user()->business_id;

        $roles = Role::where('name', 'like', "%#{$businessId}")
            ->with('permissions')
            ->get()
            ->map(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => preg_replace('/^(.+)#\d+$/', '$1', $role->name),
                    'full_name' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
            });

        return response()->json(['roles' => $roles]);
    }

    private function allowedPermissions(): array
    {
        return [
            'business_settings.access',
            'business_settings.general', 'business_settings.firm_branches', 'business_settings.case_settings',
            'user.view', 'user.create', 'user.update', 'user.delete',
            'case.view_own', 'case.view_all', 'case.create', 'case.update', 'case.delete',
            'client.create', 'client.update', 'client.delete',
            'task.view_own', 'task.view_all', 'task.create', 'task.update', 'task.delete',
            'activity_log.view',
            'product.view', 'product.create', 'product.update', 'product.delete',
            'purchase.view', 'purchase.create', 'purchase.update', 'purchase.delete',
            'sell.view', 'sell.create', 'sell.update', 'sell.delete',
        ];
    }

    private function filterPermissions(array $permissions): array
    {
        $known = $this->allowedPermissions();
        return collect($permissions)
            ->filter(fn($p) => in_array($p, $known, true) || preg_match('/^location\.\d+$/', $p))
            ->values()
            ->toArray();
    }

    public function createRole(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'permissions' => 'nullable|array',
            'permissions.*' => 'string',
        ]);

        $roleName = $validated['name'] . "#{$businessId}";

        if (Role::where('name', $roleName)->exists()) {
            return response()->json(['message' => 'Role already exists'], 422);
        }

        $role = Role::create(['name' => $roleName, 'guard_name' => 'web']);

        if (!empty($validated['permissions'])) {
            $perms = $this->filterPermissions($validated['permissions']);
            foreach ($perms as $perm) {
                Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
            }
            $role->syncPermissions($perms);
        }

        CacheTenantGet::flushTag('roles', $businessId);

        return response()->json([
            'role' => [
                'id' => $role->id,
                'name' => $validated['name'],
                'full_name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
            ],
        ], 201);
    }

    public function updateRole(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $role = Role::findById($id, 'web');
        } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
            return response()->json(['message' => 'Role not found.'], 404);
        }

        $businessId = $request->user()->business_id;

        if (!str_ends_with($role->name, "#{$businessId}")) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string',
        ]);

        $perms = $this->filterPermissions($validated['permissions']);
        foreach ($perms as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $role->syncPermissions($perms);

        CacheTenantGet::flushTag('roles', $businessId);

        return response()->json([
            'role' => [
                'id' => $role->id,
                'name' => preg_replace('/^(.+)#\d+$/', '$1', $role->name),
                'full_name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
            ],
        ]);
    }

    public function deleteRole(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $role = Role::findById($id, 'web');
        } catch (\Spatie\Permission\Exceptions\RoleDoesNotExist $e) {
            return response()->json(['message' => 'Role not found.'], 404);
        }

        $businessId = $request->user()->business_id;

        if (!str_ends_with($role->name, "#{$businessId}")) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($role->users()->count() > 0) {
            return response()->json(['message' => 'Cannot delete role with assigned users'], 422);
        }

        $role->delete();

        CacheTenantGet::flushTag('roles', $businessId);

        return response()->json(['message' => 'Role deleted']);
    }

    public function allPermissions(): JsonResponse
    {
        return response()->json([
            'permissions' => [
                'business_settings.access',
                'business_settings.general', 'business_settings.firm_branches', 'business_settings.case_settings',
                'user.view', 'user.create', 'user.update', 'user.delete',
                'case.view_own', 'case.view_all', 'case.create', 'case.update', 'case.delete', 'case.reassign',
                'client.create', 'client.update', 'client.delete',
                'task.view_own', 'task.view_all', 'task.create', 'task.update', 'task.delete',
                'expense.view_own', 'expense.view_all', 'expense.create', 'expense.update', 'expense.delete', 'expense.approve',
                'expense_report.view',
                'activity_log.view',
            ],
        ]);
    }

    private function assignLocationPermissions(User $user, array $locationIds): void
    {
        foreach ($locationIds as $locId) {
            $perm = Permission::firstOrCreate([
                'name' => "location.{$locId}",
                'guard_name' => 'web',
            ]);
            $user->givePermissionTo($perm);
        }
    }
}
