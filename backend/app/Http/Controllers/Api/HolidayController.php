<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\KenyaHolidays;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $map = KenyaHolidays::inRange($request->query('from'), $request->query('to'));

        $holidays = [];
        foreach ($map as $date => $name) {
            $holidays[] = ['date' => $date, 'name' => $name];
        }

        return response()->json(['holidays' => $holidays]);
    }
}
