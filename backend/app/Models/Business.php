<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Business extends Model
{
    protected $table = 'business';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'ref_no_prefixes' => 'array',
            'enabled_modules' => 'array',
            'email_settings' => 'array',
            'sms_settings' => 'array',
            'pos_settings' => 'array',
            'common_settings' => 'array',
            'custom_labels' => 'array',
            'weighing_scale_setting' => 'array',
            'keyboard_shortcuts' => 'array',
            'enable_tooltip' => 'boolean',
            'enable_brand' => 'boolean',
            'enable_category' => 'boolean',
            'enable_sub_category' => 'boolean',
            'enable_price_tax' => 'boolean',
            'enable_purchase_status' => 'boolean',
            'enable_product_expiry' => 'boolean',
            'enable_editing_product_from_purchase' => 'boolean',
            'enable_inline_tax' => 'boolean',
            'enable_lot_number' => 'boolean',
            'purchase_in_diff_currency' => 'boolean',
            'enable_rp' => 'boolean',
        ];
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function currency()
    {
        return $this->belongsTo(Currency::class);
    }

    public function locations()
    {
        return $this->hasMany(BusinessLocation::class);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function getBusinessAddressAttribute(): string
    {
        $location = $this->locations()->first();
        if (!$location) {
            return '';
        }
        return $location->location_address;
    }

    public static function dateFormats(): array
    {
        return [
            'm/d/Y' => 'mm/dd/yyyy',
            'd/m/Y' => 'dd/mm/yyyy',
            'm-d-Y' => 'mm-dd-yyyy',
            'd-m-Y' => 'dd-mm-yyyy',
            'Y-m-d' => 'yyyy-mm-dd',
        ];
    }
}
