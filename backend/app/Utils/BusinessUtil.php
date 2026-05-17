<?php

namespace App\Utils;

use App\Models\Business;
use App\Models\BusinessLocation;
use App\Models\Currency;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class BusinessUtil
{
    public static function newBusinessDefaultResources(int $businessId, int $userId): void
    {
        $adminRole = Role::create([
            'name' => "Admin#{$businessId}",
            'guard_name' => 'web',
        ]);

        $cashierRole = Role::create([
            'name' => "Cashier#{$businessId}",
            'guard_name' => 'web',
        ]);

        $defaultPermissions = [
            'business_settings.access',
            'user.view', 'user.create', 'user.update', 'user.delete',
            'invoice_settings.access',
            'location.access',
        ];

        foreach ($defaultPermissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $adminRole->givePermissionTo($defaultPermissions);

        $user = User::find($userId);
        if ($user) {
            $user->assignRole($adminRole);
        }
    }

    public static function createNewBusiness(array $details): Business
    {
        return Business::create($details);
    }

    public static function addLocation(int $businessId, array $details): BusinessLocation
    {
        $details['business_id'] = $businessId;
        return BusinessLocation::create($details);
    }

    public static function allCurrencies()
    {
        return Currency::all();
    }

    public static function seedCurrencies(): void
    {
        $currencies = [
            ['country' => 'United States', 'currency' => 'US Dollar', 'code' => 'USD', 'symbol' => '$', 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'European Union', 'currency' => 'Euro', 'code' => 'EUR', 'symbol' => "\u{20AC}", 'thousand_separator' => '.', 'decimal_separator' => ','],
            ['country' => 'United Kingdom', 'currency' => 'British Pound', 'code' => 'GBP', 'symbol' => "\u{00A3}", 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'India', 'currency' => 'Indian Rupee', 'code' => 'INR', 'symbol' => "\u{20B9}", 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'Canada', 'currency' => 'Canadian Dollar', 'code' => 'CAD', 'symbol' => 'C$', 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'Australia', 'currency' => 'Australian Dollar', 'code' => 'AUD', 'symbol' => 'A$', 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'Japan', 'currency' => 'Japanese Yen', 'code' => 'JPY', 'symbol' => "\u{00A5}", 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'China', 'currency' => 'Chinese Yuan', 'code' => 'CNY', 'symbol' => "\u{00A5}", 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'South Africa', 'currency' => 'South African Rand', 'code' => 'ZAR', 'symbol' => 'R', 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'Nigeria', 'currency' => 'Nigerian Naira', 'code' => 'NGN', 'symbol' => "\u{20A6}", 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'Kenya', 'currency' => 'Kenyan Shilling', 'code' => 'KES', 'symbol' => 'KSh', 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'Brazil', 'currency' => 'Brazilian Real', 'code' => 'BRL', 'symbol' => 'R$', 'thousand_separator' => '.', 'decimal_separator' => ','],
            ['country' => 'Mexico', 'currency' => 'Mexican Peso', 'code' => 'MXN', 'symbol' => 'MX$', 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'United Arab Emirates', 'currency' => 'UAE Dirham', 'code' => 'AED', 'symbol' => 'AED', 'thousand_separator' => ',', 'decimal_separator' => '.'],
            ['country' => 'Saudi Arabia', 'currency' => 'Saudi Riyal', 'code' => 'SAR', 'symbol' => 'SAR', 'thousand_separator' => ',', 'decimal_separator' => '.'],
        ];

        foreach ($currencies as $c) {
            Currency::firstOrCreate(['code' => $c['code']], $c);
        }
    }
}
