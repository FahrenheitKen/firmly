<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('client_type')->default('individual')->after('business_id');
            $table->string('client_id')->nullable()->unique()->after('client_type');
            $table->string('middle_name')->nullable()->after('last_name');
            $table->string('business_name')->nullable()->after('middle_name');
            $table->string('alternative_contact')->nullable()->after('phone');
            $table->string('tax_number')->nullable()->after('tax_id');
            $table->decimal('opening_balance', 15, 2)->default(0)->after('tax_number');
            $table->string('street')->nullable()->after('address');
            $table->string('building')->nullable()->after('street');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['client_type', 'client_id', 'middle_name', 'business_name', 'alternative_contact', 'tax_number', 'opening_balance', 'street', 'building']);
        });
    }
};
