<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Kenya official national public holidays.
 *
 * Fixed-date holidays come from the Public Holidays Act (Cap. 110).
 * Easter-based holidays are computed per year via the Meeus/Jones/Butcher
 * Gregorian algorithm. Islamic and Hindu holidays shift each year and are
 * officially gazetted by the Cabinet Secretary; the dates below reflect
 * recent gazettes and must be revised when a future year is gazetted.
 *
 * Kept deliberately in sync with frontend/src/lib/kenya-holidays.ts —
 * update both files together when the gazette changes.
 */
final class KenyaHolidays
{
    /** @var array<int, array{month:int, day:int, name:string}> */
    private const FIXED = [
        ['month' => 1,  'day' => 1,  'name' => "New Year's Day"],
        ['month' => 5,  'day' => 1,  'name' => 'Labour Day'],
        ['month' => 6,  'day' => 1,  'name' => 'Madaraka Day'],
        ['month' => 10, 'day' => 10, 'name' => 'Utamaduni Day'],
        ['month' => 10, 'day' => 20, 'name' => 'Mashujaa Day'],
        ['month' => 12, 'day' => 12, 'name' => 'Jamhuri Day'],
        ['month' => 12, 'day' => 25, 'name' => 'Christmas Day'],
        ['month' => 12, 'day' => 26, 'name' => 'Boxing Day'],
    ];

    /** @var array<string, string> */
    private const MOVABLE = [
        // Idd-ul-Fitr
        '2024-04-10' => 'Idd-ul-Fitr',
        '2025-03-31' => 'Idd-ul-Fitr',
        '2026-03-20' => 'Idd-ul-Fitr',
        '2027-03-09' => 'Idd-ul-Fitr',
        '2028-02-26' => 'Idd-ul-Fitr',
        // Idd-ul-Adha
        '2024-06-17' => 'Idd-ul-Adha',
        '2025-06-07' => 'Idd-ul-Adha',
        '2026-05-27' => 'Idd-ul-Adha',
        '2027-05-17' => 'Idd-ul-Adha',
        '2028-05-05' => 'Idd-ul-Adha',
        // Diwali
        '2024-11-01' => 'Diwali',
        '2025-10-20' => 'Diwali',
        '2026-11-08' => 'Diwali',
        '2027-10-29' => 'Diwali',
        '2028-10-17' => 'Diwali',
    ];

    /** @var array<int, array<string, string>> */
    private static array $yearCache = [];

    public static function holidayFor(mixed $date): ?string
    {
        $key = self::normalize($date);
        if ($key === null) {
            return null;
        }
        $year = (int) substr($key, 0, 4);
        return self::buildYear($year)[$key] ?? null;
    }

    public static function isHoliday(mixed $date): bool
    {
        return self::holidayFor($date) !== null;
    }

    /**
     * Return all holidays in [$from, $to] (inclusive), keyed by YYYY-MM-DD.
     *
     * @return array<string, string>
     */
    public static function inRange(mixed $from, mixed $to): array
    {
        $start = self::normalize($from);
        $end = self::normalize($to);
        if ($start === null || $end === null || $start > $end) {
            return [];
        }
        $startYear = (int) substr($start, 0, 4);
        $endYear = (int) substr($end, 0, 4);
        $out = [];
        for ($y = $startYear; $y <= $endYear; $y++) {
            foreach (self::buildYear($y) as $key => $name) {
                if ($key >= $start && $key <= $end) {
                    $out[$key] = $name;
                }
            }
        }
        ksort($out);
        return $out;
    }

    /** @return array<string, string> */
    private static function buildYear(int $year): array
    {
        if (isset(self::$yearCache[$year])) {
            return self::$yearCache[$year];
        }

        $map = [];
        foreach (self::FIXED as $h) {
            $map[sprintf('%04d-%02d-%02d', $year, $h['month'], $h['day'])] = $h['name'];
        }

        $easter = self::easterSunday($year);
        $map[$easter->subDays(2)->toDateString()] = 'Good Friday';
        $map[$easter->addDay()->toDateString()] = 'Easter Monday';

        foreach (self::MOVABLE as $key => $name) {
            if (str_starts_with($key, $year . '-')) {
                $map[$key] = $name;
            }
        }

        return self::$yearCache[$year] = $map;
    }

    private static function easterSunday(int $year): CarbonImmutable
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;
        return CarbonImmutable::create($year, $month, $day);
    }

    private static function normalize(mixed $date): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }
        if (is_string($date)) {
            if (strlen($date) < 10) {
                return null;
            }
            $head = substr($date, 0, 10);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $head)) {
                return null;
            }
            return $head;
        }
        try {
            return CarbonImmutable::parse($date)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }
}
