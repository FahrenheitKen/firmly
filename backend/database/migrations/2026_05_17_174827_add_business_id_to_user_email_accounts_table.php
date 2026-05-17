<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add column if not already present (partial migration guard)
        if (!Schema::hasColumn('user_email_accounts', 'business_id')) {
            Schema::table('user_email_accounts', function (Blueprint $table) {
                $table->unsignedBigInteger('business_id')->nullable()->after('user_id');
            });
        }

        // Backfill business_id from the related user record
        DB::statement('UPDATE user_email_accounts uea
            JOIN users u ON u.id = uea.user_id
            SET uea.business_id = u.business_id
            WHERE uea.business_id IS NULL');

        // Make non-nullable (business_id column and FK already exist from a prior partial run)
        DB::statement('ALTER TABLE user_email_accounts MODIFY business_id BIGINT UNSIGNED NOT NULL');

        // Replace single-column unique (user_id) with composite (user_id, business_id)
        DB::statement('ALTER TABLE user_email_accounts
            DROP INDEX user_email_accounts_user_id_unique,
            ADD UNIQUE INDEX user_email_accounts_user_id_business_id_unique (user_id, business_id)
        ');
    }

    public function down(): void
    {
        Schema::table('user_email_accounts', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'business_id']);
            $table->unique(['user_id']);
            $table->dropForeign(['business_id']);
            $table->dropColumn('business_id');
        });
    }
};
