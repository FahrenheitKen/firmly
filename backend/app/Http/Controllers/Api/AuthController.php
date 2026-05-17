<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\User;
use App\Models\BusinessLocation;
use App\Utils\BusinessUtil;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Redis;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'business_name' => 'required|string|max:255',
            'currency_id' => 'required|integer|exists:currencies,id',
            'first_name' => 'required|string|max:255',
            'surname' => 'nullable|string|max:10',
            'last_name' => 'nullable|string|max:255',
            'username' => 'required|string|min:4|max:255|unique:users',
            'email' => 'nullable|email|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'country' => 'required|string|max:255',

            'city' => 'required|string|max:255',
            'zip_code' => 'required|string|max:10',
            'landmark' => 'nullable|string|max:500',
            'time_zone' => 'required|string',
            'fy_start_month' => 'required|integer|min:1|max:12',
            'accounting_method' => 'required|in:fifo,lifo,avco',
            'start_date' => 'nullable|date',
            'website' => 'nullable|string|max:255',
            'mobile' => 'nullable|string|max:20',
            'alternate_number' => 'nullable|string|max:20',
        ]);

        $result = DB::transaction(function () use ($validated) {
            $user = User::create([
                'surname' => $validated['surname'] ?? null,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'] ?? null,
                'username' => $validated['username'],
                'email' => $validated['email'] ?? null,
                'password' => $validated['password'],
                'language' => 'en',
                'user_type' => 'user',
            ]);

            $business = Business::create([
                'name' => $validated['business_name'],
                'currency_id' => $validated['currency_id'],
                'owner_id' => $user->id,
                'time_zone' => $validated['time_zone'],
                'fy_start_month' => $validated['fy_start_month'],
                'accounting_method' => $validated['accounting_method'],
                'start_date' => $validated['start_date'] ?? null,
                'website' => $validated['website'] ?? null,
                'mobile' => $validated['mobile'] ?? null,
                'alternate_number' => $validated['alternate_number'] ?? null,
            ]);

            $user->update(['business_id' => $business->id]);

            $location = BusinessUtil::addLocation($business->id, [
                'name' => $validated['business_name'],
                'landmark' => $validated['landmark'] ?? '',
                'country' => $validated['country'],

                'city' => $validated['city'],
                'zip_code' => $validated['zip_code'],
                'mobile' => $validated['mobile'] ?? null,
                'alternate_number' => $validated['alternate_number'] ?? null,
                'email' => $validated['email'] ?? null,
                'website' => $validated['website'] ?? null,
            ]);

            $locPerm = Permission::firstOrCreate([
                'name' => "location.{$location->id}",
                'guard_name' => 'web',
            ]);
            $user->givePermissionTo($locPerm);

            BusinessUtil::newBusinessDefaultResources($business->id, $user->id);

            $user->update(['active_location_id' => $location->id]);

            return ['user' => $user, 'business' => $business, 'location' => $location];
        });

        $token = $result['user']->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $result['user']->load(['business', 'activeLocation']),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)
            ->orWhere('email', $request->username)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password) || !$user->allow_login) {
            throw ValidationException::withMessages([
                'username' => ['The provided credentials are incorrect.'],
            ]);
        }

        $permittedIds = $user->permittedLocations();
        if (!$user->active_location_id || (!empty($permittedIds) && !in_array($user->active_location_id, $permittedIds))) {
            $firstLoc = !empty($permittedIds)
                ? BusinessLocation::whereIn('id', $permittedIds)->first()
                : BusinessLocation::where('business_id', $user->business_id)->first();
            if ($firstLoc) {
                $user->update(['active_location_id' => $firstLoc->id]);
                $user->load('activeLocation');
            }
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        $permittedIds = $user->permittedLocations();
        $permittedLocations = BusinessLocation::whereIn('id', $permittedIds)
            ->select('id', 'name', 'city', 'country')
            ->get();

        return response()->json([
            'user' => $user->load(['business', 'roles', 'activeLocation']),
            'permitted_locations' => $permittedLocations,
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $accessToken = $request->user()->currentAccessToken();
        if ($accessToken) {
            $expirationMinutes = config('sanctum.expiration', 525600);
            $ttl = $accessToken->expires_at
                ? max(0, (int) now()->diffInSeconds($accessToken->expires_at, false))
                : $expirationMinutes * 60;

            $rawToken = $request->bearerToken();
            if ($rawToken && $ttl > 0) {
                $hash = hash('sha256', $rawToken);
                Redis::setex("token:blacklist:{$hash}", $ttl, '1');
            }

            $accessToken->delete();
        }
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $permittedIds = $user->permittedLocations();
        $permittedLocations = BusinessLocation::whereIn('id', $permittedIds)
            ->select('id', 'name', 'city', 'country')
            ->get();

        return response()->json([
            'user' => $user->load(['business', 'roles.permissions', 'activeLocation']),
            'permitted_locations' => $permittedLocations,
        ]);
    }
}
