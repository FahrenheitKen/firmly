<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OpposingCounsel extends Model
{
    protected $guarded = ['id'];

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function cases()
    {
        return $this->hasMany(Cases::class, 'opposing_counsel_id');
    }
}
