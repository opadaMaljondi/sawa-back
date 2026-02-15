<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponUsage;
use Carbon\Carbon;

class CouponService
{
    /**
     * @return array{valid: bool, discount?: float, final_amount?: float}
     */
    public function validateCoupon(string $code, int $userId, float $orderAmount): array
    {
        $coupon = Coupon::where('code', $code)->where('active', true)->first();
        if (!$coupon) {
            return ['valid' => false];
        }

        $now = Carbon::now();
        if ($now->lt($coupon->valid_from) || $now->gt($coupon->valid_until)) {
            return ['valid' => false];
        }

        if ($coupon->min_purchase !== null && $orderAmount < (float) $coupon->min_purchase) {
            return ['valid' => false];
        }

        if ($coupon->usage_limit !== null && $coupon->used_count >= $coupon->usage_limit) {
            return ['valid' => false];
        }

        $usedByUser = CouponUsage::where('coupon_id', $coupon->id)->where('user_id', $userId)->count();
        if ($usedByUser >= $coupon->usage_per_user) {
            return ['valid' => false];
        }

        $discount = $coupon->type === 'percentage'
            ? $orderAmount * ((float) $coupon->value / 100)
            : (float) $coupon->value;

        if ($coupon->max_discount !== null && $discount > (float) $coupon->max_discount) {
            $discount = (float) $coupon->max_discount;
        }

        $finalAmount = max(0, $orderAmount - $discount);

        return [
            'valid' => true,
            'discount' => $discount,
            'final_amount' => $finalAmount,
        ];
    }

    public function applyCoupon(string $code, int $userId, int $enrollmentId, float $orderAmount): void
    {
        $coupon = Coupon::where('code', $code)->firstOrFail();
        $validation = $this->validateCoupon($code, $userId, $orderAmount);
        if (!$validation['valid']) {
            throw new \InvalidArgumentException('Invalid or expired coupon');
        }

        CouponUsage::create([
            'coupon_id' => $coupon->id,
            'user_id' => $userId,
            'enrollment_id' => $enrollmentId,
            'order_amount' => $orderAmount,
            'discount_amount' => $validation['discount'],
            'final_amount' => $validation['final_amount'],
            'used_at' => now(),
        ]);

        $coupon->increment('used_count');
    }
}
