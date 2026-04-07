<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Wallet;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class InstructorAuthController extends Controller
{
    public function __construct(protected WalletService $walletService)
    {
    }

    /**
     * Login instructor
     */
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required', // email or phone
            'password' => 'required',
        ]);

        $user = User::where('email', $request->login)
            ->orWhere('phone', $request->login)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->type !== 'instructor') {
            throw ValidationException::withMessages([
                'login' => ['This account is not an instructor account.'],
            ]);
        }

        $token = $user->createToken('instructor-token')->plainTextToken;

        $wallet = Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'currency' => 'SYP']
        );

        // صلاحيات مباشرة على المستخدم فقط (كما يحددها الأدمن) — وليست صلاحيات دور instructor العامة
        $directPerms = $user->getDirectPermissions()->pluck('name')->values();

        return response()->json([
            'user' => $user,
            'token' => $token,
            'permissions' => $directPerms,
            'wallet' => [
                'balance' => $this->walletService->getBalance($user->id),
                'currency' => $wallet->currency ?? 'SYP',
                'total_deposited' => (float) ($wallet->total_deposited ?? 0),
                'total_spent' => (float) ($wallet->total_spent ?? 0),
            ],
        ]);
    }

    /**
     * Logout instructor
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }
}
