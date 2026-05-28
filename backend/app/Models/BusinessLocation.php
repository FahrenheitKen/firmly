<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BusinessLocation extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'featured_products' => 'array',
            'default_payment_accounts' => 'array',
            'is_active' => 'boolean',
            'print_receipt_on_invoice' => 'boolean',
        ];
    }

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function users()
    {
        return $this->hasMany(User::class, 'active_location_id');
    }

    public function clients()
    {
        return $this->hasMany(Client::class, 'location_id');
    }

    public function cases()
    {
        return $this->hasMany(Cases::class, 'location_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function getLocationAddressAttribute(): string
    {
        $parts = array_filter([
            $this->landmark,
            $this->city,
            $this->country,
            $this->zip_code,
        ]);
        return implode(', ', $parts);
    }

    public static function forDropdown(int $businessId, bool $showAll = false): array
    {
        $query = self::where('business_id', $businessId);
        if (!$showAll) {
            $query->active();
        }
        return $query->pluck('name', 'id')->toArray();
    }
}
