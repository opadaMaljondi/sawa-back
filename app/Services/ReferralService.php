<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\Referral;
use App\Models\Setting;
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
        $code = 'SAWA'.strtoupper(Str::random(6));
        while (User::where('referral_code', $code)->exists()) {
            $code = 'SAWA'.strtoupper(Str::random(6));
        }
        User::where('id', $userId)->update(['referral_code' => $code]);

        return $code;
    }

    /**
     * Link referred student to referrer at registration. No wallet changes.
     * Referrer is paid only after the invited user's first subscription (see grantBonusOnPurchase).
     */
    public function applyReferralCode(int $referredUserId, string $code): void
    {
        $normalized = strtoupper(trim($code));
        if ($normalized === '') {
            return;
        }

        $referrer = User::where('referral_code', $normalized)
            ->where('type', 'student')
            ->where('id', '!=', $referredUserId)
            ->first();

        if (! $referrer) {
            return;
        }

        Referral::firstOrCreate(
            [
                'referrer_id' => $referrer->id,
                'referred_id' => $referredUserId,
            ],
            [
                'referral_code' => $normalized,
                'bonus_status' => 'pending',
            ]
        );
    }

    /**
     * Discount on catalog price for the invited user's first-ever enrollment (before coupons).
     */
    public function computeFirstSubscriptionDiscount(int $studentId, float $catalogPrice): float
    {
        if (! Setting::get('referral_program_enabled', true)) {
            return 0.0;
        }
        if ($catalogPrice <= 0) {
            return 0.0;
        }
        if (! Referral::where('referred_id', $studentId)->where('bonus_status', 'pending')->exists()) {
            return 0.0;
        }
        if (Enrollment::where('student_id', $studentId)->exists()) {
            return 0.0;
        }

        $percent = max(0.0, min(100.0, (float) Setting::get('referral_first_subscription_discount_percent', 0)));
        $fixed = max(0.0, (float) Setting::get('referral_first_subscription_discount_fixed', 0));

        $discount = 0.0;
        if ($percent > 0) {
            $discount = round($catalogPrice * ($percent / 100.0), 2);
        } elseif ($fixed > 0) {
            $discount = min($fixed, $catalogPrice);
        }

        return min(max($discount, 0.0), $catalogPrice);
    }

    /**
     * Credit referrer wallet when the invited user completes their first paid enrollment.
     */
    public function grantBonusOnPurchase(int $enrollmentId): void
    {
        $studentId = auth()->id();

        $referral = Referral::where('referred_id', $studentId)
            ->where('bonus_status', 'pending')
            ->first();

        if (! $referral) {
            return;
        }

        if (! Setting::get('referral_program_enabled', true)) {
            return;
        }

        $enrollment = Enrollment::find($enrollmentId);
        if (! $enrollment || $enrollment->student_id !== $studentId) {
            return;
        }

        // Only the first subscription counts for the referrer bonus
        if (Enrollment::where('student_id', $studentId)->count() !== 1) {
            return;
        }

        $bonusAmount = (float) Setting::get('referral_enrollment_bonus', config('referral.bonus_amount', 0));
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
            'Referral — first subscription bonus',
            [
                'referral_id' => $referral->id,
                'enrollment_id' => $enrollmentId,
                'referred_id' => $referral->referred_id,
                'type' => 'referral_enrollment_bonus',
            ]
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
