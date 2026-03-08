<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    /**
     * List all student wallets with balance info.
     *
     * GET /admin/wallets?search=&min_balance=&max_balance=
     */
    public function index(Request $request)
    {
        $query = Wallet::with('user:id,full_name,email,phone,type')
            ->whereHas('user', fn ($q) => $q->where('type', 'student'));

        if ($request->filled('search')) {
            $s = $request->search;
            $query->whereHas('user', fn ($q) => $q
                ->where('full_name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
            );
        }

        if ($request->filled('min_balance')) {
            $query->where('balance', '>=', $request->min_balance);
        }

        if ($request->filled('max_balance')) {
            $query->where('balance', '<=', $request->max_balance);
        }

        return response()->json(
            $query->orderBy('balance', 'desc')->paginate($request->integer('limit', 20))
        );
    }

    /**
     * Show wallet + last 50 transactions for a specific student.
     *
     * GET /admin/wallets/{userId}
     */
    public function show($userId)
    {
        $user = User::findOrFail($userId);

        $wallet = Wallet::where('user_id', $userId)->firstOrFail();

        $transactions = Transaction::where('wallet_id', $wallet->id)
            ->latest()
            ->paginate(50);

        return response()->json([
            'user'         => $user->only(['id', 'full_name', 'email', 'phone']),
            'wallet'       => $wallet,
            'transactions' => $transactions,
        ]);
    }

    /**
     * Adjust wallet balance for any student.
     *
     * POST /admin/wallets/{userId}/adjust
     * Body: { type: deposit|withdraw|refund, amount: 5000, note: "reason" }
     */
    public function adjust(Request $request, $userId)
    {
        $request->validate([
            'type'   => 'required|in:deposit,withdraw,refund',
            'amount' => 'required|numeric|min:0.01',
            'note'   => 'nullable|string|max:500',
        ]);

        $user          = User::findOrFail($userId);
        $walletService = app(\App\Services\WalletService::class);
        $noteText      = $request->note ?? 'Admin adjustment';
        $meta          = ['admin_id' => auth()->id(), 'note' => $request->note];

        if ($request->type === 'deposit') {
            $walletService->deposit($user->id, (float) $request->amount, "إيداع: {$noteText}", $meta);
        } elseif ($request->type === 'refund') {
            $walletService->refund($user->id, (float) $request->amount, "استرداد: {$noteText}", $meta);
        } else {
            try {
                $walletService->withdraw($user->id, (float) $request->amount, "خصم: {$noteText}", $meta);
            } catch (\InvalidArgumentException) {
                return response()->json(['message' => 'Insufficient balance.'], 400);
            }
        }

        return response()->json([
            'message' => 'Wallet adjusted successfully.',
            'wallet'  => Wallet::where('user_id', $user->id)->first(),
        ]);
    }

    /**
     * All transactions across all wallets (filterable).
     *
     * GET /admin/wallets/transactions?type=refund&from=2026-01-01&to=2026-03-31
     */
    public function transactions(Request $request)
    {
        $query = Transaction::with(['wallet.user:id,full_name,email'])->latest();

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->whereHas('wallet.user', fn ($q) => $q
                ->where('full_name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
            );
        }

        return response()->json($query->paginate($request->integer('limit', 20)));
    }
}
