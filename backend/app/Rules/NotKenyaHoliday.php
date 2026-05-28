<?php

namespace App\Rules;

use App\Support\KenyaHolidays;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class NotKenyaHoliday implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value === null || $value === '') {
            return;
        }
        $name = KenyaHolidays::holidayFor($value);
        if ($name !== null) {
            $fail("This date falls on a Kenyan public holiday ({$name}). Pick another day.");
        }
    }
}
