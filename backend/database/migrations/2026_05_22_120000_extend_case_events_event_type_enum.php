<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE case_events MODIFY COLUMN event_type "
            . "ENUM('Bring Up', 'Mention', 'Hearing', 'Ruling', 'Judgement', "
            . "'Hearing of Application', 'Mention of Application') NOT NULL"
        );
    }

    public function down(): void
    {
        DB::statement(
            "ALTER TABLE case_events MODIFY COLUMN event_type "
            . "ENUM('Bring Up', 'Mention', 'Hearing', 'Ruling', 'Judgement') NOT NULL"
        );
    }
};
