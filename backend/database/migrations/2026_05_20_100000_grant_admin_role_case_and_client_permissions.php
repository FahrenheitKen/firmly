<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private array $permissions = [
        'case.view_all',
        'case.create',
        'case.update',
        'case.delete',
        'client.create',
        'client.update',
        'client.delete',
    ];

    public function up(): void
    {
        foreach ($this->permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        Role::where('name', 'like', 'Admin#%')
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo($this->permissions));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Role::where('name', 'like', 'Admin#%')
            ->get()
            ->each(fn (Role $role) => $role->revokePermissionTo($this->permissions));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
