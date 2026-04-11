<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ReferralService;
use App\Support\StudentWalletQr;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Register a new student account.
     */
    public function registerStudent(Request $request)
    {
        $data = $request->validate([
            'full_name'     => 'required|string|max:255',
            'email'         => 'required|email|unique:users,email',
            'phone'         => 'required|string|unique:users,phone',
            'password'      => 'required|string|min:6|confirmed',
            'referral_code' => 'nullable|string|max:32',
            'image'         => 'nullable|image',
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('profiles', 'public');
        }

        $user = User::create([
            'full_name' => $data['full_name'],
            'email'     => $data['email'],
            'phone'     => $data['phone'],
            'password'  => Hash::make($data['password']),
            'image'     => $imagePath,
            'type'      => 'student',
        ]);

        // Assign role if Spatie roles are configured
        if (method_exists($user, 'assignRole')) {
            $user->assignRole('student');
        }

        $user->wallet()->create([
            'balance' => 0,
            'currency' => 'SYP',
            'total_deposited' => 0,
            'total_spent' => 0,
            'active' => true,
        ]);

        if (! empty($data['referral_code'] ?? null)) {
            app(ReferralService::class)->applyReferralCode($user->id, $data['referral_code']);
        }

        $user->load(['wallet', 'department', 'year']);

        $token = $user->createToken('student-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
            'wallet_qr' => StudentWalletQr::qrPayload($user->id),
            'profile_complete' => ! is_null($user->department_id) && ! is_null($user->year_id),
        ], 201);
    }

    /**
     * Login using email or phone.
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            'login'    => 'nullable|string', // email or phone
            'email'    => 'nullable|string',
            'phone'    => 'nullable|string',
            'password' => 'required|string',
        ]);

        $loginValue = (string) ($data['login'] ?? $data['email'] ?? $data['phone'] ?? '');
        if ($loginValue === '') {
            return response()->json([
                'message' => 'Provide one of: login, email, or phone.',
            ], 422);
        }

        $user = User::where('email', $loginValue)
            ->orWhere('phone', $loginValue)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials',
            ], 422);
        }

        $token = $user->createToken($user->type . '-token')->plainTextToken;

        $payload = [
            'user' => $user,
            'token' => $token,
        ];

        if ($user->type === 'student') {
            $user->loadMissing('wallet');
            if (! $user->wallet) {
                $user->wallet()->create([
                    'balance' => 0,
                    'currency' => 'SYP',
                    'total_deposited' => 0,
                    'total_spent' => 0,
                    'active' => true,
                ]);
                $user->load('wallet');
            }
            $user->load(['department', 'year']);
            $payload['user'] = $user;
            $payload['wallet_qr'] = StudentWalletQr::qrPayload($user->id);
            $payload['profile_complete'] = ! is_null($user->department_id) && ! is_null($user->year_id);
        }

        return response()->json($payload);
    }
}

