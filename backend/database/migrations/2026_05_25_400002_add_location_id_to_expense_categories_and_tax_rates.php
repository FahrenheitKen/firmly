<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            $table->unsignedBigInteger('location_id')->nullable()->after('business_id');
            $table->foreign('location_id')->references('id')->on('business_locations')->onDelete('cascade');
        });

        Schema::table('tax_rates', function (Blueprint $table) {
            $table->unsignedBigInteger('location_id')->nullable()->after('business_id');
            $table->foreign('location_id')->references('id')->on('business_locations')->onDelete('cascade');
        });

        // Backfill both tables with the first location of each business
        foreach (['expense_categories', 'tax_rates'] as $tbl) {
            DB::statement("
                UPDATE {$tbl} t
                JOIN business_locations bl ON bl.business_id = t.business_id
                SET t.location_id = bl.id
                WHERE t.location_id IS NULL
                AND bl.id = (
                    SELECT MIN(bl2.id) FROM business_locations bl2 WHERE bl2.business_id = t.business_id
                )
            ");
        }
    }

    public function down(): void
    {
        Schema::table('expense_categories', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');
        });

        Schema::table('tax_rates', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');
        });
    }
};
