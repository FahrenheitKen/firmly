<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date',
            'is_billable' => 'boolean',
            'amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_before_tax' => 'decimal:2',
            'is_recurring' => 'boolean',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
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

    public function category()
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function subCategory()
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_sub_category_id');
    }

    public function case()
    {
        return $this->belongsTo(Cases::class, 'case_id');
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function expenseForUser()
    {
        return $this->belongsTo(User::class, 'expense_for_user_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function tax()
    {
        return $this->belongsTo(TaxRate::class, 'tax_id');
    }

    public function recurParent()
    {
        return $this->belongsTo(self::class, 'recur_parent_id');
    }

    public function recurringChildren()
    {
        return $this->hasMany(self::class, 'recur_parent_id');
    }
}
