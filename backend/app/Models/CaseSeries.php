<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CaseSeries extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'common_parties' => 'array',
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

    public function parentSeries()
    {
        return $this->belongsTo(self::class, 'parent_series_id');
    }

    public function childSeries()
    {
        return $this->hasMany(self::class, 'parent_series_id');
    }

    public function cases()
    {
        return $this->hasMany(Cases::class, 'case_series_id');
    }

    public function activeCases()
    {
        return $this->hasMany(Cases::class, 'case_series_id')->whereNull('deleted_at');
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function nextSuffix(): string
    {
        $last = $this->last_suffix;
        if ($last === '') {
            return 'A';
        }
        $len = strlen($last);
        $i = $len - 1;
        while ($i >= 0) {
            if ($last[$i] !== 'Z') {
                $last[$i] = chr(ord($last[$i]) + 1);
                return $last;
            }
            $last[$i] = 'A';
            $i--;
        }
        return 'A' . $last;
    }
}
