<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        Permission::firstOrCreate(['name' => 'case.reassign', 'guard_name' => 'web']);

        Role::where('name', 'like', 'Admin#%')
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo('case.reassign'));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Role::where('name', 'like', 'Admin#%')
            ->get()
            ->each(fn (Role $role) => $role->revokePermissionTo('case.reassign'));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
