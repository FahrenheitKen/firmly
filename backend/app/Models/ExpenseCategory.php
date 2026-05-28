<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExpenseCategory extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    public function business()
    {
        return $this->belongsTo(Business::class);
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function subCategories()
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class, 'expense_category_id');
    }

    public function scopeOnlyParents($query)
    {
        return $query->whereNull('parent_id');
    }
}
