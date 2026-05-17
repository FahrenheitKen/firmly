<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserContactAccess extends Model
{
    protected $table = 'user_contact_access';

    protected $guarded = ['id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
