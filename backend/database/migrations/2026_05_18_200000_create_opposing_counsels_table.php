<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('opposing_counsels', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('business_id');
            $table->string('name');
            $table->string('firm')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();

            $table->foreign('business_id')->references('id')->on('business')->onDelete('cascade');
        });

        Schema::table('cases', function (Blueprint $table) {
            $table->dropColumn('opposing_counsel');
            $table->unsignedBigInteger('opposing_counsel_id')->nullable()->after('client_reference');
            $table->foreign('opposing_counsel_id')->references('id')->on('opposing_counsels')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->dropForeign(['opposing_counsel_id']);
            $table->dropColumn('opposing_counsel_id');
            $table->string('opposing_counsel')->nullable()->after('client_reference');
        });

        Schema::dropIfExists('opposing_counsels');
    }
};
