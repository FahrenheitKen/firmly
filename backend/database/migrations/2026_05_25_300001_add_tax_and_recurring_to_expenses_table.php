<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->unsignedBigInteger('tax_id')->nullable()->after('payment_method');
            $table->decimal('tax_amount', 14, 2)->default(0)->after('tax_id');
            $table->decimal('total_before_tax', 14, 2)->default(0)->after('tax_amount');

            $table->boolean('is_recurring')->default(false)->after('description');
            $table->unsignedSmallInteger('recur_interval')->nullable()->after('is_recurring');
            $table->enum('recur_interval_type', ['days', 'months', 'years'])->nullable()->after('recur_interval');
            $table->unsignedSmallInteger('recur_repetitions')->nullable()->after('recur_interval_type');
            $table->unsignedSmallInteger('recur_repeat_on')->nullable()->after('recur_repetitions');
            $table->unsignedBigInteger('recur_parent_id')->nullable()->after('recur_repeat_on');
            $table->timestamp('recur_stopped_on')->nullable()->after('recur_parent_id');

            $table->foreign('tax_id')->references('id')->on('tax_rates')->onDelete('set null');
            $table->foreign('recur_parent_id')->references('id')->on('expenses')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['tax_id']);
            $table->dropForeign(['recur_parent_id']);
            $table->dropColumn([
                'tax_id', 'tax_amount', 'total_before_tax',
                'is_recurring', 'recur_interval', 'recur_interval_type',
                'recur_repetitions', 'recur_repeat_on', 'recur_parent_id', 'recur_stopped_on',
            ]);
        });
    }
};
