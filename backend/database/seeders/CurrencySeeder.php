<?php

namespace Database\Seeders;

use App\Utils\BusinessUtil;
use Illuminate\Database\Seeder;

class CurrencySeeder extends Seeder
{
    public function run(): void
    {
        BusinessUtil::seedCurrencies();
    }
}
