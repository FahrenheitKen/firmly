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
        // Make nullable first so we can clear old enum values
        DB::statement("ALTER TABLE cases MODIFY case_type ENUM('Civil','Criminal','Corporate','Family','Other','Plaintiff','Defendant') NULL DEFAULT NULL");
        DB::statement("UPDATE cases SET case_type = NULL WHERE case_type NOT IN ('Plaintiff', 'Defendant')");
        DB::statement("ALTER TABLE cases MODIFY case_type ENUM('Plaintiff', 'Defendant') NULL DEFAULT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE cases MODIFY case_type ENUM('Civil', 'Criminal', 'Corporate', 'Family', 'Other') NOT NULL DEFAULT 'Other'");
    }
};
