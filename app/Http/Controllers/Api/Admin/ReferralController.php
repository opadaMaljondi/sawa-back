<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Referral;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    public function index(Request $request)
    {
        $query = Referral::query()
            ->with([
                'referrer:id,full_name,email,phone,referral_code',
                'referred:id,full_name,email,phone',
            ])
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $s = '%'.$request->string('search').'%';
            $query->where(function ($q) use ($s) {
                $q->where('referral_code', 'like', $s)
                    ->orWhereHas('referrer', fn ($qq) => $qq->where('full_name', 'like', $s)->orWhere('email', 'like', $s))
                    ->orWhereHas('referred', fn ($qq) => $qq->where('full_name', 'like', $s)->orWhere('email', 'like', $s));
            });
        }

        if ($request->filled('bonus_status')) {
            $query->where('bonus_status', $request->string('bonus_status'));
        }

        return response()->json(
            $query->paginate((int) $request->integer('per_page', 20))
        );
    }

    public function stats()
    {
        $byStatus = Referral::query()
            ->selectRaw('bonus_status, COUNT(*) as c')
            ->groupBy('bonus_status')
            ->pluck('c', 'bonus_status');

        return response()->json([
            'total_referrals' => Referral::count(),
            'by_status' => $byStatus,
        ]);
    }
}
