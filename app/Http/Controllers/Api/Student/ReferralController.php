<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Services\ReferralService;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    protected ReferralService $referralService;

    public function __construct(ReferralService $referralService)
    {
        $this->referralService = $referralService;
    }

    /**
     * Get my referral code
     */
    public function myCode()
    {
        $user = auth()->user();
        $code = $this->referralService->generateReferralCode($user->id);

        return response()->json([
            'referral_code' => $code,
            'referral_url' => url('/register?ref=' . $code),
        ]);
    }

    /**
     * Get referral statistics
     */
    public function stats()
    {
        $stats = $this->referralService->getUserReferralStats(auth()->id());

        return response()->json($stats);
    }

    /**
     * Get referral list
     */
    public function referrals()
    {
        $referrals = \App\Models\Referral::where('referrer_id', auth()->id())
            ->with(['referred', 'enrollment.course'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($referrals);
    }
}
