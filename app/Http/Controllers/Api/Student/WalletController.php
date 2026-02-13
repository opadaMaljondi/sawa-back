<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Services\WalletService;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    protected WalletService $walletService;

    public function __construct(WalletService $walletService)
    {
        $this->walletService = $walletService;
    }

    /**
     * Get wallet balance
     */
    public function balance()
    {
        $balance = $this->walletService->getBalance(auth()->id());
        $wallet = auth()->user()->wallet;

        return response()->json([
            'balance' => $balance,
            'currency' => $wallet->currency ?? 'IQD',
            'total_deposited' => $wallet->total_deposited ?? 0,
            'total_spent' => $wallet->total_spent ?? 0,
        ]);
    }

    /**
     * Get wallet transactions
     */
    public function transactions(Request $request)
    {
        $transactions = $this->walletService->getTransactions(
            auth()->id(),
            $request->get('per_page', 20)
        );

        return response()->json($transactions);
    }

    /**
     * Deposit to wallet (via barcode or admin)
     */
    public function deposit(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:1',
            'barcode' => 'nullable|string',
            'payment_method' => 'required|in:barcode,admin',
        ]);

        // في حالة الباركود، يتم التحقق من الباركود أولاً
        if ($request->payment_method === 'barcode' && $request->barcode) {
            // هنا يتم التحقق من الباركود مع نظام الدفع
            // ثم يتم إيداع المبلغ
        }

        $transaction = $this->walletService->deposit(
            auth()->id(),
            $request->amount,
            'Wallet deposit',
            [
                'payment_method' => $request->payment_method,
                'barcode' => $request->barcode,
            ]
        );

        return response()->json([
            'message' => 'Deposit successful',
            'transaction' => $transaction,
        ], 201);
    }
}
