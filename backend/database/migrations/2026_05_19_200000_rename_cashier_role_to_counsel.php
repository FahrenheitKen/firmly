<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('roles')
            ->where('name', 'like', 'Cashier#%')
            ->update([
                'name' => DB::raw("REPLACE(name, 'Cashier#', 'Counsel#')"),
            ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        DB::table('roles')
            ->where('name', 'like', 'Counsel#%')
            ->update([
                'name' => DB::raw("REPLACE(name, 'Counsel#', 'Cashier#')"),
            ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
