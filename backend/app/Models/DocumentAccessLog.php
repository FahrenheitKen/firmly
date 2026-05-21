<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentAccessLog extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function caseDocument()
    {
        return $this->belongsTo(CaseDocument::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
