<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\CacheTenantGet;
use App\Models\Business;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $business = Business::with(['currency', 'owner'])
            ->findOrFail($request->user()->business_id);

        return response()->json(['business' => $business]);
    }

    public function update(Request $request): JsonResponse
    {
        $u = $request->user();
        $canEdit = $u->isOwner()
            || $u->hasPermissionSafe('business_settings.access')
            || $u->hasPermissionSafe('business_settings.general')
            || $u->hasPermissionSafe('business_settings.case_settings');
        if (!$canEdit) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $business = Business::findOrFail($request->user()->business_id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'start_date' => 'nullable|date',
            'tax_number_1' => 'nullable|string|max:100',
            'tax_number_2' => 'nullable|string|max:100',
            'default_profit_percent' => 'nullable|numeric|min:0',
            'default_sales_discount' => 'nullable|numeric|min:0',
            'sell_price_tax' => 'nullable|in:includes,excludes',
            'time_zone' => 'nullable|string',
            'fy_start_month' => 'nullable|integer|min:1|max:12',
            'accounting_method' => 'nullable|in:fifo,lifo,avco',
            'transaction_edit_days' => 'nullable|integer|min:0',
            'date_format' => 'nullable|string',
            'time_format' => 'nullable|in:12,24',
            'currency_symbol_placement' => 'nullable|in:before,after',
            'theme_color' => 'nullable|string|max:25',
            'currency_precision' => 'nullable|integer|min:0|max:4',
            'quantity_precision' => 'nullable|integer|min:0|max:4',
            'enable_tooltip' => 'nullable|boolean',
            'enable_brand' => 'nullable|boolean',
            'enable_category' => 'nullable|boolean',
            'enable_sub_category' => 'nullable|boolean',
            'enable_price_tax' => 'nullable|boolean',
            'enable_purchase_status' => 'nullable|boolean',
            'enable_product_expiry' => 'nullable|boolean',
            'enable_lot_number' => 'nullable|boolean',
            'enable_inline_tax' => 'nullable|boolean',
            'enable_editing_product_from_purchase' => 'nullable|boolean',
            'purchase_in_diff_currency' => 'nullable|boolean',
            'enable_rp' => 'nullable|boolean',
            'rp_name' => 'nullable|string|max:100',
            'amount_for_unit_rp' => 'nullable|numeric',
            'min_order_total_for_rp' => 'nullable|numeric',
            'max_rp_per_order' => 'nullable|numeric',
            'redeem_amount_per_unit_rp' => 'nullable|numeric',
            'min_order_total_for_redeem' => 'nullable|numeric',
            'min_redeem_point' => 'nullable|numeric',
            'max_redeem_point' => 'nullable|numeric',
            'rp_expiry_period' => 'nullable|integer',
            'rp_expiry_type' => 'nullable|string',
            'custom_labels' => 'nullable|array',
            'common_settings' => 'nullable|array',
            'sms_settings' => 'nullable|array',
            'pos_settings' => 'nullable|array',
            'ref_no_prefixes' => 'nullable|array',
            'enabled_modules' => 'nullable|array',
            'keyboard_shortcuts' => 'nullable|array',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048|file',
            'weighing_scale_setting' => 'nullable|array',
            'sales_cmsn_agnt' => 'nullable|in:logged_in_user,user,cmsn_agnt',
            'item_addition_method' => 'nullable|string',
            'on_product_expiry' => 'nullable|string',
            'stop_selling_before' => 'nullable|integer',
            'stock_expiry_alert_days' => 'nullable|integer',
            'code_label_1' => 'nullable|string',
            'code_1' => 'nullable|string',
            'code_label_2' => 'nullable|string',
            'code_2' => 'nullable|string',
            'default_case_status' => 'nullable|string',
            'default_case_priority' => 'nullable|string',
        ]);

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->storeAs('business', $request->file('logo')->hashName(), 'public');
            $validated['logo'] = $path;
        }

        $business->update($validated);

        CacheTenantGet::flushTag('business', $request->user()->business_id);

        return response()->json(['business' => $business->fresh(['currency'])]);
    }

    public function currencies(): JsonResponse
    {
        return response()->json(['currencies' => \App\Utils\BusinessUtil::allCurrencies()]);
    }

    public function dateFormats(): JsonResponse
    {
        return response()->json(['date_formats' => Business::dateFormats()]);
    }
}
