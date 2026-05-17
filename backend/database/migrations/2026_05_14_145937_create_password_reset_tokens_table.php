<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration
{
    public function up(): void
    {
        // Table already exists in 0001_01_01_000000_create_users_table.php
    }
    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
    }
};
