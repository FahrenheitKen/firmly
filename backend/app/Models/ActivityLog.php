<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
        ];
    }

    public function causer()
    {
        return $this->belongsTo(User::class, 'causer_id');
    }

    public function business()
    {
        return $this->belongsTo(Business::class);
    }
}
