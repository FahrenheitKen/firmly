<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('opposing_counsels', function (Blueprint $table) {
            $table->unsignedBigInteger('location_id')->nullable()->after('business_id');
            $table->foreign('location_id')->references('id')->on('business_locations')->onDelete('cascade');
        });

        // Backfill: set location_id from the user's active location or the first location of the business
        DB::statement("
            UPDATE opposing_counsels oc
            JOIN business_locations bl ON bl.business_id = oc.business_id
            SET oc.location_id = bl.id
            WHERE oc.location_id IS NULL
            AND bl.id = (
                SELECT MIN(bl2.id) FROM business_locations bl2 WHERE bl2.business_id = oc.business_id
            )
        ");
    }

    public function down(): void
    {
        Schema::table('opposing_counsels', function (Blueprint $table) {
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');
        });
    }
};
