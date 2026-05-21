<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private array $permissions = [
        'task.view_all',
        'task.view_own',
        'task.create',
        'task.update',
        'task.delete',
    ];

    public function up(): void
    {
        foreach ($this->permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // Admins get full task access; view_own is also granted so the permission
        // exists in the registry for non-admin roles to use via the picker.
        Role::where('name', 'like', 'Admin#%')
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo([
                'task.view_all',
                'task.create',
                'task.update',
                'task.delete',
            ]));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Role::where('name', 'like', 'Admin#%')
            ->get()
            ->each(fn (Role $role) => $role->revokePermissionTo([
                'task.view_all',
                'task.create',
                'task.update',
                'task.delete',
            ]));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
