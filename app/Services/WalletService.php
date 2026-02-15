<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Support\Str;

class WalletService
{
    public function getBalance(int $userId): float
    {
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $userId],
            ['balance' => 0, 'currency' => 'SYP']
        );
        return (float) $wallet->balance;
    }

    public function hasEnoughBalance(int $userId, float $amount): bool
    {
        return $this->getBalance($userId) >= $amount;
    }

    public function withdraw(int $userId, float $amount, string $title, array $meta = []): Transaction
    {
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $userId],
            ['balance' => 0, 'currency' => 'SYP']
        );

        $balanceBefore = (float) $wallet->balance;
        if ($balanceBefore < $amount) {
            throw new \InvalidArgumentException('Insufficient balance');
        }

        $wallet->balance = $balanceBefore - $amount;
        $wallet->total_spent = (float) $wallet->total_spent + $amount;
        $wallet->save();

        return Transaction::create([
            'wallet_id' => $wallet->id,
            'transaction_number' => 'TXN-' . strtoupper(Str::random(12)),
            'type' => 'withdrawal',
            'amount' => -$amount,
            'balance_before' => $balanceBefore,
            'balance_after' => $wallet->balance,
            'title' => $title,
            'metadata' => $meta,
            'status' => 'completed',
        ]);
    }

    public function deposit(int $userId, float $amount, string $title, array $meta = []): Transaction
    {
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $userId],
            ['balance' => 0, 'currency' => 'SYP']
        );

        $balanceBefore = (float) $wallet->balance;
        $wallet->balance = $balanceBefore + $amount;
        $wallet->total_deposited = (float) $wallet->total_deposited + $amount;
        $wallet->save();

        return Transaction::create([
            'wallet_id' => $wallet->id,
            'transaction_number' => 'TXN-' . strtoupper(Str::random(12)),
            'type' => 'deposit',
            'amount' => $amount,
            'balance_before' => $balanceBefore,
            'balance_after' => $wallet->balance,
            'title' => $title,
            'metadata' => $meta,
            'status' => 'completed',
        ]);
    }

    public function getTransactions(int $userId, int $perPage = 20)
    {
        $wallet = Wallet::where('user_id', $userId)->first();
        if (!$wallet) {
            return new \Illuminate\Pagination\LengthAwarePaginator([], 0, $perPage);
        }
        return Transaction::where('wallet_id', $wallet->id)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
    }
}
