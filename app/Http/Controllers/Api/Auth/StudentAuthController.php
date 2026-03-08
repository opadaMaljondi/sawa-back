<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StudentAuthController extends Controller
{
    /**
     * Register a new student
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'full_name'     => 'required|string|max:255',
            'email'         => 'required|email|unique:users,email',
            'phone'         => 'required|string|unique:users,phone',
            'password'      => 'required|string|min:6|confirmed',
            'department_id' => 'nullable|exists:departments,id',
            'year_id'       => 'nullable|exists:years,id',
            'referral_code' => 'nullable|string',
        ]);

        $user = User::create([
            'full_name'     => $data['full_name'],
            'email'         => $data['email'],
            'phone'         => $data['phone'],
            'password'      => Hash::make($data['password']),
            'type'          => 'student',
            'department_id' => $data['department_id'] ?? null,
            'year_id'       => $data['year_id'] ?? null,
        ]);

        $user->assignRole('student');

        $user->wallet()->create([
            'balance'         => 0,
            'currency'        => 'SYP',
            'total_deposited' => 0,
            'total_spent'     => 0,
            'active'          => true,
        ]);

        if (!empty($data['referral_code'])) {
            app(\App\Services\ReferralService::class)->applyReferralCode($user->id, $data['referral_code']);
        }

        $token = $user->createToken('student-token')->plainTextToken;

        return response()->json([
            'user'             => $user,
            'token'            => $token,
            'profile_complete' => !is_null($user->department_id) && !is_null($user->year_id),
        ], 201);
    }

    /**
     * Login student (email or phone + password)
     */
    public function login(Request $request)
    {
        $request->validate([
            'login'    => 'required',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->login)
            ->orWhere('phone', $request->login)
            ->first();

        if (!$user || !$user->password || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->type !== 'student') {
            throw ValidationException::withMessages([
                'login' => ['This account is not a student account.'],
            ]);
        }

        if (!$user->active) {
            throw ValidationException::withMessages([
                'login' => ['Your account has been suspended.'],
            ]);
        }

        $token = $user->createToken('student-token')->plainTextToken;

        return response()->json([
            'user'             => $user,
            'token'            => $token,
            'profile_complete' => !is_null($user->department_id) && !is_null($user->year_id),
        ]);
    }

    /**
     * Login or register via Google OAuth.
     * Mobile app sends the Google ID token obtained from Google Sign-In SDK.
     */
    public function googleAuth(Request $request)
    {
        $request->validate([
            'id_token' => 'required|string',
        ]);

        $client  = new \Google\Client(['client_id' => config('services.google.client_id')]);
        $payload = $client->verifyIdToken($request->id_token);

        if (!$payload) {
            return response()->json(['message' => 'Invalid Google token.'], 401);
        }

        $googleId = $payload['sub'];
        $email    = $payload['email'];
        $name     = $payload['name'] ?? $payload['email'];
        $isNew    = false;

        $user = User::where('google_id', $googleId)
            ->orWhere('email', $email)
            ->first();

        if (!$user) {
            $isNew = true;
            $user  = User::create([
                'full_name' => $name,
                'email'     => $email,
                'google_id' => $googleId,
                'type'      => 'student',
                'password'  => Hash::make(Str::random(32)),
            ]);
            $user->assignRole('student');
            $user->wallet()->create([
                'balance'         => 0,
                'currency'        => 'SYP',
                'total_deposited' => 0,
                'total_spent'     => 0,
                'active'          => true,
            ]);
        } elseif (!$user->google_id) {
            $user->update(['google_id' => $googleId]);
        }

        if ($user->type !== 'student') {
            return response()->json(['message' => 'This account is not a student account.'], 403);
        }

        if (!$user->active) {
            return response()->json(['message' => 'Your account has been suspended.'], 403);
        }

        $token = $user->createToken('student-token')->plainTextToken;

        return response()->json([
            'user'             => $user,
            'token'            => $token,
            'profile_complete' => !is_null($user->department_id) && !is_null($user->year_id),
        ], $isNew ? 201 : 200);
    }

    /**
     * Logout student
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }
}
