<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourtProceeding extends Model
{
    protected $guarded = ['id'];

    public function case()
    {
        return $this->belongsTo(Cases::class, 'case_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function dueForEvent()
    {
        return $this->belongsTo(CaseEvent::class, 'due_for_event_id');
    }

    public function bringUpEvent()
    {
        return $this->belongsTo(CaseEvent::class, 'bring_up_event_id');
    }
}
