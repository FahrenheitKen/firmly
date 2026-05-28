<?php

namespace App\Console\Commands;

use App\Models\Business;
use App\Models\Expense;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateRecurringExpenses extends Command
{
    protected $signature = 'expenses:generate-recurring';
    protected $description = 'Generate recurring expense entries';

    public function handle(): int
    {
        $parents = Expense::where('is_recurring', true)
            ->whereNull('recur_stopped_on')
            ->whereNotNull('recur_interval')
            ->whereNotNull('recur_interval_type')
            ->get();

        $generated = 0;

        foreach ($parents as $parent) {
            $lastGenerated = $parent->recurringChildren()
                ->max('expense_date') ?: $parent->expense_date;
            $lastDate = Carbon::parse($lastGenerated);
            $today = Carbon::today();

            $diff = match ($parent->recur_interval_type) {
                'days' => $lastDate->diffInDays($today),
                'months' => $this->diffMonths($lastDate, $today, $parent->recur_repeat_on),
                'years' => $lastDate->diffInYears($today),
                default => 0,
            };

            if ($diff === 0 || $diff % $parent->recur_interval !== 0) {
                continue;
            }

            if ($parent->recur_repetitions) {
                $existing = $parent->recurringChildren()->count();
                if ($existing >= $parent->recur_repetitions) {
                    continue;
                }
            }

            $business = Business::find($parent->business_id);
            $counter = ($business->expense_counter ?? 0) + 1;
            $business->update(['expense_counter' => $counter]);

            Expense::create([
                'business_id' => $parent->business_id,
                'location_id' => $parent->location_id,
                'expense_number' => 'EXP-' . str_pad($counter, 4, '0', STR_PAD_LEFT),
                'expense_category_id' => $parent->expense_category_id,
                'expense_sub_category_id' => $parent->expense_sub_category_id,
                'case_id' => $parent->case_id,
                'client_id' => $parent->client_id,
                'amount' => $parent->amount,
                'expense_date' => $today,
                'payment_status' => 'due',
                'payment_method' => $parent->payment_method,
                'tax_id' => $parent->tax_id,
                'tax_amount' => $parent->tax_amount,
                'total_before_tax' => $parent->total_before_tax,
                'is_billable' => $parent->is_billable,
                'description' => $parent->description,
                'created_by' => $parent->created_by,
                'recur_parent_id' => $parent->id,
            ]);

            $generated++;
        }

        $this->info("Generated {$generated} recurring expense(s).");

        return self::SUCCESS;
    }

    private function diffMonths(Carbon $from, Carbon $to, ?int $repeatOn): int
    {
        if ($repeatOn) {
            $from = $from->copy()->day(min($repeatOn, $from->daysInMonth));
        }
        return $from->diffInMonths($to);
    }
}
