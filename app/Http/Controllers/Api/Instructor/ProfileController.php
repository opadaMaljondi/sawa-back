<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function __construct(protected WalletService $walletService)
    {
    }

    public function show()
    {
        $user = auth()->user()->load('wallet');

        return response()->json([
            'user'        => $this->formatUser($user),
            'permissions' => $user->getDirectPermissions()->pluck('name')->values(),
            'wallet'      => $this->walletSummary($user->id),
        ]);
    }

    public function update(Request $request)
    {
        $user = auth()->user();

        $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'email'     => 'sometimes|email|unique:users,email,'.$user->id,
            'phone'     => 'nullable|string|max:30',
            'specialty' => 'nullable|string|max:255',
            'bio'       => 'nullable|string|max:5000',
            'password'  => 'nullable|string|min:6|confirmed',
            'image'     => 'nullable|image|max:5120',
        ]);

        $data = $request->only(['full_name', 'email', 'phone', 'specialty', 'bio']);

        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        if ($request->hasFile('image')) {
            if ($user->image && ! filter_var($user->image, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($user->getRawOriginal('image'));
            }
            $data['image'] = $request->file('image')->store('users', 'public');
        }

        $user->update($data);

        return response()->json([
            'message' => 'Profile updated',
            'user'    => $this->formatUser($user->fresh()),
        ]);
    }

    public function permissions()
    {
        return response()->json([
            'permissions' => auth()->user()->getDirectPermissions()->pluck('name')->values(),
        ]);
    }

    protected function formatUser(User $user): array
    {
        return [
            'id'         => $user->id,
            'full_name'  => $user->full_name,
            'email'      => $user->email,
            'phone'      => $user->phone,
            'image'      => $user->image_url,
            'specialty'  => $user->specialty,
            'bio'        => $user->bio,
            'type'       => $user->type,
            'active'     => $user->active,
        ];
    }

    protected function walletSummary(int $userId): array
    {
        $balance = $this->walletService->getBalance($userId);
        $w = \App\Models\Wallet::where('user_id', $userId)->first();

        return [
            'balance'         => $balance,
            'currency'        => $w->currency ?? 'SYP',
            'total_deposited' => (float) ($w->total_deposited ?? 0),
            'total_spent'     => (float) ($w->total_spent ?? 0),
        ];
    }
}
