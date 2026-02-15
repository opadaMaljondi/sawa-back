<?php

namespace App\Services;

use App\Models\Referral;
use App\Models\User;
use Illuminate\Support\Str;

class ReferralService
{
    public function generateReferralCode(int $userId): string
    {
        $user = User::find($userId);
        if ($user && $user->referral_code) {
            return $user->referral_code;
        }
        $code = 'SAWA' . strtoupper(Str::random(6));
        while (User::where('referral_code', $code)->exists()) {
            $code = 'SAWA' . strtoupper(Str::random(6));
        }
        User::where('id', $userId)->update(['referral_code' => $code]);
        return $code;
    }

    public function applyReferralCode(int $referredUserId, string $code): void
    {
        $referrer = User::where('referral_code', $code)
            ->where('type', 'student')
            ->where('id', '!=', $referredUserId)
            ->first();

        if (!$referrer) {
            return;
        }

        Referral::firstOrCreate(
            [
                'referrer_id' => $referrer->id,
                'referred_id' => $referredUserId,
            ],
            [
                'referral_code' => $code,
                'bonus_status' => 'pending',
            ]
        );
    }

    public function grantBonusOnPurchase(int $enrollmentId): void
    {
        $referral = Referral::where('referred_id', auth()->id())
            ->where('bonus_status', 'pending')
            ->first();

        if (!$referral) {
            return;
        }

        $enrollment = \App\Models\Enrollment::find($enrollmentId);
        if (!$enrollment) {
            return;
        }

        $bonusAmount = (float) config('referral.bonus_amount', 0);
        if ($bonusAmount <= 0) {
            return;
        }

        $referral->update([
            'enrollment_id' => $enrollmentId,
            'purchase_amount' => $enrollment->final_price,
            'bonus_amount' => $bonusAmount,
            'bonus_status' => 'earned',
        ]);

        $walletService = app(WalletService::class);
        $walletService->deposit(
            $referral->referrer_id,
            $bonusAmount,
            'Referral bonus',
            ['enrollment_id' => $enrollmentId, 'referred_id' => $referral->referred_id]
        );

        $referral->update(['bonus_status' => 'paid', 'paid_at' => now()]);
    }

    public function getUserReferralStats(int $userId): array
    {
        $totalReferrals = Referral::where('referrer_id', $userId)->count();
        $totalBonus = Referral::where('referrer_id', $userId)->sum('bonus_amount');
        $code = User::find($userId)?->referral_code ?? $this->generateReferralCode($userId);

        return [
            'referral_code' => $code,
            'total_referrals' => $totalReferrals,
            'total_bonus_earned' => (float) $totalBonus,
        ];
    }
}
