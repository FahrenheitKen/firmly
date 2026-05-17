<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_email_accounts', function (Blueprint $table) {
            $table->unsignedBigInteger('location_id')->nullable()->after('business_id');
            $table->foreign('location_id')->references('id')->on('business_locations')->onDelete('cascade');
        });

        // Backfill location_id from the user's active_location_id
        DB::statement('UPDATE user_email_accounts uea
            JOIN users u ON u.id = uea.user_id
            SET uea.location_id = u.active_location_id
            WHERE uea.location_id IS NULL');

        // Replace old unique (user_id, business_id) with (user_id, location_id)
        // — a user can have one email account per location
        DB::statement('ALTER TABLE user_email_accounts
            DROP INDEX user_email_accounts_user_id_business_id_unique,
            ADD UNIQUE INDEX user_email_accounts_user_id_location_id_unique (user_id, location_id)
        ');
    }

    public function down(): void
    {
        Schema::table('user_email_accounts', function (Blueprint $table) {
            $table->dropUnique('user_email_accounts_user_id_location_id_unique');
            $table->unique(['user_id', 'business_id']);
            $table->dropForeign(['location_id']);
            $table->dropColumn('location_id');
        });
    }
};
