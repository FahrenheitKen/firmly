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
        'bank_details',
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

    private ?array $permittedLocationsCache = null;

    public function permittedLocations($businessId = null)
    {
        $businessId = $businessId ?? $this->business_id;

        if ($this->permittedLocationsCache !== null) {
            return $this->permittedLocationsCache;
        }

        if ($this->isOwner()) {
            $this->permittedLocationsCache = BusinessLocation::where('business_id', $businessId)
                ->pluck('id')
                ->toArray();
        } else {
            $this->permittedLocationsCache = $this->permissions()
                ->where('name', 'like', 'location.%')
                ->pluck('name')
                ->map(fn($p) => (int) str_replace('location.', '', $p))
                ->toArray();
        }

        return $this->permittedLocationsCache;
    }

    public function canAccessLocation($locationId): bool
    {
        return in_array($locationId, $this->permittedLocations());
    }

    /**
     * Spatie's hasPermissionTo() throws if the permission name does not yet
     * exist in the DB. New permissions are only created on the fly when a
     * role first uses them, so checks for not-yet-used permissions would
     * crash without this wrapper.
     */
    public function hasPermissionSafe(string $permission): bool
    {
        try {
            return $this->hasPermissionTo($permission);
        } catch (\Spatie\Permission\Exceptions\PermissionDoesNotExist $e) {
            return false;
        }
    }

    /** Whether the user can see any cases at all (any view scope). */
    public function canViewAnyCase(): bool
    {
        if ($this->isOwner()) {
            return true;
        }
        return $this->hasPermissionSafe('case.view_all')
            || $this->hasPermissionSafe('case.view_own')
            || $this->hasPermissionSafe('case.view'); // legacy alias
    }

    /**
     * Whether the user can see a specific case identified by its assigned_to
     * column. Owners and view_all users see everything; view_own users see
     * only cases assigned to them.
     */
    public function canViewCase(?int $assignedTo): bool
    {
        if ($this->isOwner()) {
            return true;
        }
        if ($this->hasPermissionSafe('case.view_all') || $this->hasPermissionSafe('case.view')) {
            return true;
        }
        if ($this->hasPermissionSafe('case.view_own') && $assignedTo !== null && $assignedTo === $this->id) {
            return true;
        }
        return false;
    }

    /**
     * Whether the user is scoped to cases assigned to them. Used by list
     * endpoints (cases index, calendar) to apply an assigned_to filter.
     */
    public function restrictedToOwnCases(): bool
    {
        if ($this->isOwner()) {
            return false;
        }
        if ($this->hasPermissionSafe('case.view_all') || $this->hasPermissionSafe('case.view')) {
            return false;
        }
        return $this->hasPermissionSafe('case.view_own');
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
