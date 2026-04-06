<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Wallet;
use App\Services\WalletService;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function __construct(protected WalletService $walletService)
    {
    }

    /**
     * Wallet + balance (same shape as student; instructor earnings go here).
     */
    public function show()
    {
        $userId = auth()->id();
        $balance = $this->walletService->getBalance($userId);
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $userId],
            ['balance' => 0, 'currency' => 'SYP']
        );

        return response()->json([
            'wallet' => [
                'balance'          => $balance,
                'currency'         => $wallet->currency ?? 'SYP',
                'total_deposited'  => (float) ($wallet->total_deposited ?? 0),
                'total_spent'      => (float) ($wallet->total_spent ?? 0),
            ],
        ]);
    }

    public function transactions(Request $request)
    {
        $type = $request->query('type'); // e.g. withdrawal, deposit, purchase, refund, referral
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        return response()->json(
            $this->walletService->getTransactions(auth()->id(), $perPage, $type)
        );
    }

    /**
     * Withdrawals only (payouts / admin withdrawals from instructor wallet).
     */
    public function withdrawals(Request $request)
    {
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        return response()->json(
            $this->walletService->getTransactions(auth()->id(), $perPage, 'withdrawal')
        );
    }
}
