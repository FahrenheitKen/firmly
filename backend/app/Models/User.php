<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasRoles, HasApiTokens;

    protected $guarded = ['id'];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'bank_details' => 'array',
            'allow_login' => 'boolean',
            'is_cmmsn_agnt' => 'boolean',
            'selected_contacts' => 'boolean',
        ];
    }

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function activeLocation()
    {
        return $this->belongsTo(BusinessLocation::class, 'active_location_id');
    }

    public function contactAccess()
    {
        return $this->hasMany(UserContactAccess::class);
    }

    public function scopeForBusiness($query, $businessId)
    {
        return $query->where('business_id', $businessId);
    }

    public function scopeActive($query)
    {
        return $query->where('allow_login', true);
    }

    public function isOwner(): bool
    {
        return $this->business && $this->business->owner_id === $this->id;
    }

    public function permittedLocations($businessId = null)
    {
        $businessId = $businessId ?? $this->business_id;

        // Business owner can access all locations
        if ($this->isOwner()) {
            return BusinessLocation::where('business_id', $businessId)
                ->pluck('id')
                ->toArray();
        }

        return $this->permissions()
            ->where('name', 'like', 'location.%')
            ->pluck('name')
            ->map(fn($p) => (int) str_replace('location.', '', $p))
            ->toArray();
    }

    public function canAccessLocation($locationId): bool
    {
        return in_array($locationId, $this->permittedLocations());
    }

    public function getUserFullNameAttribute(): string
    {
        return trim(($this->surname ?? '') . ' ' . $this->first_name . ' ' . ($this->last_name ?? ''));
    }

    public function getRoleNameAttribute(): string
    {
        $role = $this->roles->first();
        return $role ? preg_replace('/^(.+)#\d+$/', '$1', $role->name) : '';
    }

    public static function createUser(array $details): self
    {
        return self::create($details);
    }

    public static function forDropdown(int $businessId, bool $prependNone = true): array
    {
        $users = self::where('business_id', $businessId)
            ->select('id', 'first_name', 'last_name', 'surname')
            ->get()
            ->mapWithKeys(fn($u) => [$u->id => $u->user_full_name])
            ->toArray();

        if ($prependNone) {
            $users = ['' => __('None')] + $users;
        }

        return $users;
    }
}
