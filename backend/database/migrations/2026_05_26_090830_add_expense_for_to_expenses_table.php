<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('expense_for')->nullable()->after('description');
            $table->foreignId('expense_for_user_id')->nullable()->after('expense_for')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['expense_for_user_id']);
            $table->dropColumn(['expense_for', 'expense_for_user_id']);
        });
    }
};
