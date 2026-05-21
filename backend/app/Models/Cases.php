<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cases extends Model
{
    use SoftDeletes;

    protected $table = 'cases';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'filed_date' => 'date',
            'closed_date' => 'date',
        ];
    }

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function location()
    {
        return $this->belongsTo(BusinessLocation::class, 'location_id');
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function assignedTo()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function documents()
    {
        return $this->hasMany(CaseDocument::class, 'case_id');
    }

    public function events()
    {
        return $this->hasMany(CaseEvent::class, 'case_id');
    }

    public function proceedings()
    {
        return $this->hasMany(CourtProceeding::class, 'case_id');
    }

    public function opposingCounsel()
    {
        return $this->belongsTo(\App\Models\OpposingCounsel::class, 'opposing_counsel_id');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class, 'case_id');
    }
}
