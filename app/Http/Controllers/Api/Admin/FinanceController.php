<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;

class FinanceController extends Controller
{
    /**
     * Aggregated financial totals for the admin dashboard (wallets + course revenue splits).
     *
     * GET /api/admin/finance/platform-totals
     */
    public function platformTotals()
    {
        $studentDeposits = (float) Transaction::query()
            ->join('wallets', 'transactions.wallet_id', '=', 'wallets.id')
            ->join('users', 'wallets.user_id', '=', 'users.id')
            ->where('users.type', 'student')
            ->where('transactions.type', 'deposit')
            ->where('transactions.status', 'completed')
            ->sum('transactions.amount');

        $studentRefunds = (float) Transaction::query()
            ->join('wallets', 'transactions.wallet_id', '=', 'wallets.id')
            ->join('users', 'wallets.user_id', '=', 'users.id')
            ->where('users.type', 'student')
            ->where('transactions.type', 'refund')
            ->where('transactions.status', 'completed')
            ->sum('transactions.amount');

        $studentSpending = (float) Transaction::query()
            ->join('wallets', 'transactions.wallet_id', '=', 'wallets.id')
            ->join('users', 'wallets.user_id', '=', 'users.id')
            ->where('users.type', 'student')
            ->where('transactions.type', 'withdrawal')
            ->where('transactions.status', 'completed')
            ->sum(DB::raw('ABS(transactions.amount)'));

        $instructorDeposits = (float) Transaction::query()
            ->join('wallets', 'transactions.wallet_id', '=', 'wallets.id')
            ->join('users', 'wallets.user_id', '=', 'users.id')
            ->where('users.type', 'instructor')
            ->where('transactions.type', 'deposit')
            ->where('transactions.status', 'completed')
            ->sum('transactions.amount');

        $instructorWithdrawals = (float) Transaction::query()
            ->join('wallets', 'transactions.wallet_id', '=', 'wallets.id')
            ->join('users', 'wallets.user_id', '=', 'users.id')
            ->where('users.type', 'instructor')
            ->where('transactions.type', 'withdrawal')
            ->where('transactions.status', 'completed')
            ->sum(DB::raw('ABS(transactions.amount)'));

        $coursePaymentsGross = (float) Enrollment::where('active', true)->sum('final_price');

        $platformCommission = 0.0;
        $teacherShareAccrued = 0.0;

        Enrollment::query()
            ->where('active', true)
            ->with('course:id,admin_commission')
            ->chunk(1000, function ($rows) use (&$platformCommission, &$teacherShareAccrued) {
                foreach ($rows as $e) {
                    $course = $e->course;
                    if (! $course) {
                        continue;
                    }
                    $final = (float) $e->final_price;
                    $rate = (float) ($course->admin_commission ?? 0) / 100;
                    $adminAmt = round($final * $rate, 2);
                    $platformCommission += $adminAmt;
                    $teacherShareAccrued += round($final - $adminAmt, 2);
                }
            });

        $platformCommission = round($platformCommission, 2);
        $teacherShareAccrued = round($teacherShareAccrued, 2);

        $studentWalletsBalance = (float) Wallet::query()
            ->whereHas('user', fn ($q) => $q->where('type', 'student'))
            ->sum('balance');

        $instructorWalletsBalance = (float) Wallet::query()
            ->whereHas('user', fn ($q) => $q->where('type', 'instructor'))
            ->sum('balance');

        return response()->json([
            'student_wallet_deposits_total' => round($studentDeposits, 2),
            'student_wallet_refunds_total' => round($studentRefunds, 2),
            'student_wallet_spending_total' => round($studentSpending, 2),
            'student_wallets_balance_total' => round($studentWalletsBalance, 2),
            'course_payments_gross_total' => round($coursePaymentsGross, 2),
            'platform_commission_total' => $platformCommission,
            'teacher_share_accrued_total' => $teacherShareAccrued,
            'instructor_wallet_deposits_total' => round($instructorDeposits, 2),
            'instructor_withdrawals_total' => round($instructorWithdrawals, 2),
            'instructor_wallets_balance_total' => round($instructorWalletsBalance, 2),
        ]);
    }
}
