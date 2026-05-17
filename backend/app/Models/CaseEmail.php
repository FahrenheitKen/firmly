<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CaseEmail extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'to_addresses' => 'array',
            'cc_addresses' => 'array',
            'attachment_names' => 'array',
            'has_attachments' => 'boolean',
        ];
    }

    public function case()
    {
        return $this->belongsTo(Cases::class, 'case_id');
    }

    public function emailAccount()
    {
        return $this->belongsTo(UserEmailAccount::class);
    }
}
