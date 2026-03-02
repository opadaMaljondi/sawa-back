<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;

class CouponController extends Controller
{
    /**
     * Get all currently valid coupons with full details,
     * including whether the current student can still use each one.
     */
    public function index(Request $request)
    {
        $userId  = $request->user()->id;

        $coupons = Coupon::valid()
            ->get()
            ->map(function ($coupon) use ($userId) {
                $userUsageCount = $coupon->usages()->where('user_id', $userId)->count();

                return [
                    'id'              => $coupon->id,
                    'code'            => $coupon->code,
                    'description'     => $coupon->description,
                    'type'            => $coupon->type,
                    'value'           => $coupon->value,
                    'formatted_value' => $coupon->getFormattedValue(),
                    'min_purchase'    => $coupon->min_purchase,
                    'max_discount'    => $coupon->max_discount,
                    'usage_per_user'  => $coupon->usage_per_user,
                    'used_by_me'      => $userUsageCount,
                    'can_use'         => $coupon->canBeUsedBy($userId),
                    'valid_from'      => $coupon->valid_from?->toDateString(),
                    'valid_until'     => $coupon->valid_until?->toDateString(),
                    'usage_limit'     => $coupon->usage_limit,
                    'used_count'      => $coupon->used_count,
                ];
            });

        return response()->json(['coupons' => $coupons]);
    }

    /**
     * Check a coupon code and return discount info.
     */
    public function check(Request $request)
    {
        $request->validate([
            'code'   => 'required|string',
            'amount' => 'required|numeric|min:0',
        ]);

        $coupon = Coupon::where('code', $request->code)->first();

        if (!$coupon || !$coupon->isValid()) {
            return response()->json(['valid' => false, 'message' => 'Coupon not found or expired.'], 422);
        }

        if (!$coupon->canBeUsedBy($request->user()->id)) {
            return response()->json(['valid' => false, 'message' => 'You have reached the usage limit for this coupon.'], 422);
        }

        $discount   = $coupon->calculateDiscount((float) $request->amount);
        $finalPrice = max(0, $request->amount - $discount);

        return response()->json([
            'valid'        => true,
            'code'         => $coupon->code,
            'type'         => $coupon->type,
            'value'        => $coupon->value,
            'discount'     => $discount,
            'final_price'  => $finalPrice,
        ]);
    }
}
