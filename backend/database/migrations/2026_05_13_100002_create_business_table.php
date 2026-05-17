<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedBigInteger('currency_id');
            $table->date('start_date')->nullable();
            $table->string('tax_number_1', 100)->nullable();
            $table->string('tax_label_1', 10)->nullable();
            $table->string('tax_number_2', 100)->nullable();
            $table->string('tax_label_2', 10)->nullable();
            $table->decimal('default_profit_percent', 5, 2)->default(0);
            $table->unsignedBigInteger('owner_id');
            $table->string('time_zone')->default('Asia/Kolkata');
            $table->tinyInteger('fy_start_month')->default(1);
            $table->enum('accounting_method', ['fifo', 'lifo', 'avco'])->default('fifo');
            $table->decimal('default_sales_discount', 5, 2)->nullable();
            $table->enum('sell_price_tax', ['includes', 'excludes'])->default('includes');
            $table->string('logo')->nullable();
            $table->string('sku_prefix')->nullable();
            $table->boolean('enable_tooltip')->default(true);
            $table->boolean('purchase_in_diff_currency')->default(false);
            $table->unsignedBigInteger('purchase_currency_id')->nullable();
            $table->decimal('p_exchange_rate', 20, 3)->default(1);
            $table->unsignedInteger('transaction_edit_days')->default(30);
            $table->unsignedInteger('stock_expiry_alert_days')->default(30);
            $table->boolean('enable_product_expiry')->default(false);
            $table->text('keyboard_shortcuts')->nullable();
            $table->boolean('enable_brand')->default(true);
            $table->boolean('enable_category')->default(true);
            $table->boolean('enable_sub_category')->default(true);
            $table->boolean('enable_price_tax')->default(true);
            $table->boolean('enable_purchase_status')->default(true);
            $table->unsignedBigInteger('default_unit')->nullable();
            $table->text('email_settings')->nullable();
            $table->text('sms_settings')->nullable();
            $table->boolean('enable_editing_product_from_purchase')->default(true);
            $table->boolean('enable_inline_tax')->default(false);
            $table->enum('sales_cmsn_agnt', ['logged_in_user', 'user', 'cmsn_agnt'])->nullable();
            $table->string('item_addition_method')->default('dropdown');
            $table->string('on_product_expiry')->default('keep_selling');
            $table->integer('stop_selling_before')->nullable();
            $table->string('expiry_type')->default('add_expiry');
            $table->text('pos_settings')->nullable();
            $table->boolean('enable_lot_number')->default(false);
            $table->string('date_format')->default('m/d/Y');
            $table->enum('time_format', ['12', '24'])->default('24');
            $table->text('ref_no_prefixes')->nullable();
            $table->string('theme_color')->nullable();
            $table->text('custom_labels')->nullable();
            $table->text('common_settings')->nullable();
            $table->string('currency_symbol_placement')->default('before');
            $table->text('enabled_modules')->nullable();
            $table->string('rp_name')->nullable();
            $table->boolean('enable_rp')->default(false);
            $table->decimal('amount_for_unit_rp', 22, 4)->default(1);
            $table->decimal('min_order_total_for_rp', 22, 4)->default(1);
            $table->decimal('max_rp_per_order', 22, 4)->nullable();
            $table->decimal('redeem_amount_per_unit_rp', 22, 4)->default(1);
            $table->decimal('min_order_total_for_redeem', 22, 4)->default(1);
            $table->decimal('min_redeem_point', 22, 4)->nullable();
            $table->decimal('max_redeem_point', 22, 4)->nullable();
            $table->integer('rp_expiry_period')->nullable();
            $table->string('rp_expiry_type')->default('month');
            $table->string('code_label_1')->nullable();
            $table->string('code_1')->nullable();
            $table->string('code_label_2')->nullable();
            $table->string('code_2')->nullable();
            $table->tinyInteger('currency_precision')->default(2);
            $table->tinyInteger('quantity_precision')->default(2);
            $table->text('weighing_scale_setting')->nullable();
            $table->timestamps();

            $table->foreign('currency_id')->references('id')->on('currencies');
            $table->foreign('owner_id')->references('id')->on('users');
        });

        // Add business_id foreign key to users
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('business_id')->references('id')->on('business');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['business_id']);
        });
        Schema::dropIfExists('business');
    }
};
