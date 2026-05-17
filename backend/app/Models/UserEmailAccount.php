<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserEmailAccount extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'token_expires_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'sync_enabled' => 'boolean',
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function location()
    {
        return $this->belongsTo(BusinessLocation::class, 'location_id');
    }

    public function emails()
    {
        return $this->hasMany(CaseEmail::class);
    }
}
