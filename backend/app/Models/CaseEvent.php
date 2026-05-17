<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CaseEvent extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
        ];
    }

    public function case()
    {
        return $this->belongsTo(Cases::class, 'case_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
