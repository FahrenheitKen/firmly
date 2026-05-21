<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CaseDocument extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        // Defense in depth: even if a controller forgets the business_id
        // filter, queries from an authenticated request never see another
        // tenant's rows. CLI contexts (artisan, queue workers) bypass the
        // scope because auth()->check() is false — needed by the backfill
        // and GC cron.
        static::addGlobalScope('tenant', function (Builder $query): void {
            if (auth()->check()) {
                $query->where($query->getModel()->getTable() . '.business_id', auth()->user()->business_id);
            }
        });
    }

    public function case()
    {
        return $this->belongsTo(Cases::class, 'case_id');
    }

    public function uploadedBy()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
