<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    private array $permissions = [
        'expense.view_all',
        'expense.view_own',
        'expense.create',
        'expense.update',
        'expense.delete',
        'expense.approve',
        'expense_report.view',
    ];

    public function up(): void
    {
        foreach ($this->permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        Role::where('name', 'like', 'Admin#%')
            ->get()
            ->each(fn (Role $role) => $role->givePermissionTo([
                'expense.view_all',
                'expense.create',
                'expense.update',
                'expense.delete',
                'expense.approve',
                'expense_report.view',
            ]));

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
