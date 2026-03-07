<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Course;
use App\Models\Department;
use App\Models\Enrollment;
use App\Models\SupportMessage;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    // ─────────────────────────────────────────────────────────────
    // 1. Main overview stats
    // GET /admin/dashboard/stats
    // ─────────────────────────────────────────────────────────────
    public function stats()
    {
        // Users
        $totalStudents    = User::where('type', 'student')->count();
        $totalInstructors = User::where('type', 'instructor')->count();
        $newStudentsMonth = User::where('type', 'student')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();
        $bannedStudents = User::where('type', 'student')->where('active', false)->count();

        // Courses
        $totalCourses     = Course::count();
        $activeCourses    = Course::where('active', true)->where('status', 'published')->count();
        $pendingCourses   = Course::where('status', 'pending')->count();
        $draftCourses     = Course::where('status', 'draft')->count();
        $suspendedCourses = Course::where('active', false)->where('status', 'published')->count();

        // Enrollments
        $totalEnrollments    = Enrollment::where('active', true)->count();
        $enrollmentsMonth    = Enrollment::where('active', true)
            ->whereMonth('enrolled_at', now()->month)
            ->whereYear('enrolled_at', now()->year)
            ->count();
        $cancelledEnrollments = Enrollment::where('active', false)->count();

        // Enrollments by type
        $byType = Enrollment::where('active', true)
            ->select('type', DB::raw('COUNT(*) as count'), DB::raw('SUM(final_price) as revenue'))
            ->groupBy('type')
            ->get()
            ->keyBy('type');

        // Revenue
        $totalRevenue   = Enrollment::where('active', true)->sum('final_price');
        $totalDiscounts = Enrollment::where('active', true)->sum('discount');
        $revenueMonth   = Enrollment::where('active', true)
            ->whereMonth('enrolled_at', now()->month)
            ->whereYear('enrolled_at', now()->year)
            ->sum('final_price');

        // Refunds
        $totalRefunds  = Transaction::where('type', 'refund')->sum('amount');
        $refundsCount  = Transaction::where('type', 'refund')->count();
        $refundsMonth  = Transaction::where('type', 'refund')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('amount');

        // Wallets
        $totalWalletBalance   = Wallet::sum('balance');
        $totalWalletDeposited = Wallet::sum('total_deposited');
        $totalWalletSpent     = Wallet::sum('total_spent');

        // Coupons
        $activeCoupons  = Coupon::where('active', true)->count();
        $totalCouponUse = CouponUsage::count();
        $totalSaved     = CouponUsage::sum('discount_amount');

        // Support
        $newSupport = SupportMessage::where('status', 'new')->count();

        // Monthly chart — last 12 months
        $monthlyStats = Enrollment::where('active', true)
            ->select(
                DB::raw('YEAR(enrolled_at) as year'),
                DB::raw('MONTH(enrolled_at) as month'),
                DB::raw('COUNT(*) as enrollments'),
                DB::raw('SUM(final_price) as revenue'),
                DB::raw('SUM(discount) as discounts')
            )
            ->groupBy('year', 'month')
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->limit(12)
            ->get();

        return response()->json([
            'stats' => [
                // Users
                'total_students'       => $totalStudents,
                'total_instructors'    => $totalInstructors,
                'new_students_month'   => $newStudentsMonth,
                'banned_students'      => $bannedStudents,
                // Courses
                'total_courses'        => $totalCourses,
                'active_courses'       => $activeCourses,
                'pending_courses'      => $pendingCourses,
                'draft_courses'        => $draftCourses,
                'suspended_courses'    => $suspendedCourses,
                // Enrollments
                'total_enrollments'        => $totalEnrollments,
                'enrollments_month'        => $enrollmentsMonth,
                'cancelled_enrollments'    => $cancelledEnrollments,
                'enrollments_by_type'      => [
                    'full_course' => ['count' => $byType['full_course']->count ?? 0, 'revenue' => $byType['full_course']->revenue ?? 0],
                    'section'     => ['count' => $byType['section']->count ?? 0,     'revenue' => $byType['section']->revenue ?? 0],
                    'lesson'      => ['count' => $byType['lesson']->count ?? 0,      'revenue' => $byType['lesson']->revenue ?? 0],
                    'attachment'  => ['count' => $byType['attachment']->count ?? 0,  'revenue' => $byType['attachment']->revenue ?? 0],
                ],
                // Revenue
                'total_revenue'        => $totalRevenue,
                'total_discounts'      => $totalDiscounts,
                'revenue_month'        => $revenueMonth,
                // Refunds
                'total_refunds'        => $totalRefunds,
                'refunds_count'        => $refundsCount,
                'refunds_month'        => $refundsMonth,
                // Wallets
                'wallet_total_balance'    => $totalWalletBalance,
                'wallet_total_deposited'  => $totalWalletDeposited,
                'wallet_total_spent'      => $totalWalletSpent,
                // Coupons & Support
                'active_coupons'       => $activeCoupons,
                'total_coupon_uses'    => $totalCouponUse,
                'total_saved_coupons'  => $totalSaved,
                'new_support_messages' => $newSupport,
            ],
            'monthly_stats' => $monthlyStats,
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Top 10 courses by students
    // GET /admin/dashboard/top-courses
    // ─────────────────────────────────────────────────────────────
    public function topCourses()
    {
        $courses = Course::with(['instructor:id,full_name,image', 'subject:id,name'])
            ->withCount(['enrollments as active_enrollments' => fn ($q) => $q->where('active', true)])
            ->withSum(['enrollments as total_revenue' => fn ($q) => $q->where('active', true)], 'final_price')
            ->orderBy('students_count', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($c) => [
                'id'                 => $c->id,
                'title'              => $c->title,
                'image'              => $c->image,
                'price'              => $c->price,
                'status'             => $c->status,
                'active'             => $c->active,
                'students_count'     => $c->students_count,
                'active_enrollments' => $c->active_enrollments,
                'total_revenue'      => $c->total_revenue ?? 0,
                'instructor'         => $c->instructor?->only(['id', 'full_name', 'image']),
                'subject'            => $c->subject?->only(['id', 'name']),
            ]);

        return response()->json(['courses' => $courses]);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Recent 20 enrollments
    // GET /admin/dashboard/recent-enrollments
    // ─────────────────────────────────────────────────────────────
    public function recentEnrollments()
    {
        $enrollments = Enrollment::with([
            'student:id,full_name,email,phone',
            'course:id,title,price',
            'section:id,title',
            'lesson:id,title',
            'note:id,title',
        ])
            ->orderBy('enrolled_at', 'desc')
            ->limit(20)
            ->get()
            ->map(fn ($e) => [
                'id'             => $e->id,
                'student'        => $e->student?->only(['id', 'full_name', 'email', 'phone']),
                'course'         => $e->course?->only(['id', 'title', 'price']),
                'type'           => $e->type,
                'section'        => $e->section?->only(['id', 'title']),
                'lesson'         => $e->lesson?->only(['id', 'title']),
                'note'           => $e->note?->only(['id', 'title']),
                'original_price' => $e->original_price,
                'discount'       => $e->discount,
                'final_price'    => $e->final_price,
                'coupon_code'    => $e->coupon_code,
                'active'         => $e->active,
                'enrolled_at'    => $e->enrolled_at?->toDateTimeString(),
            ]);

        return response()->json(['enrollments' => $enrollments]);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Courses pending admin approval
    // GET /admin/dashboard/pending-courses
    // ─────────────────────────────────────────────────────────────
    public function pendingCourses()
    {
        $courses = Course::with(['instructor:id,full_name,image', 'subject:id,name'])
            ->where('status', 'pending')
            ->latest()
            ->paginate(20);

        return response()->json($courses);
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Revenue breakdown per instructor (top 10)
    // GET /admin/dashboard/revenue-by-instructor
    // ─────────────────────────────────────────────────────────────
    public function revenueByInstructor()
    {
        $data = User::where('type', 'instructor')
            ->select(
                'users.id',
                'users.full_name',
                'users.email',
                'users.image',
                DB::raw('COUNT(DISTINCT courses.id) as total_courses'),
                DB::raw('COUNT(enrollments.id) as total_enrollments'),
                DB::raw('COALESCE(SUM(enrollments.final_price), 0) as total_revenue')
            )
            ->leftJoin('courses', 'users.id', '=', 'courses.instructor_id')
            ->leftJoin('enrollments', function ($join) {
                $join->on('courses.id', '=', 'enrollments.course_id')
                     ->where('enrollments.active', true);
            })
            ->groupBy('users.id', 'users.full_name', 'users.email', 'users.image')
            ->orderByDesc('total_revenue')
            ->limit(10)
            ->get();

        return response()->json(['instructors' => $data]);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Revenue breakdown per department
    // GET /admin/dashboard/revenue-by-department
    // ─────────────────────────────────────────────────────────────
    public function revenueByDepartment()
    {
        $data = Department::select(
                'departments.id',
                'departments.name',
                'departments.color',
                DB::raw('COUNT(DISTINCT courses.id) as total_courses'),
                DB::raw('COUNT(enrollments.id) as total_enrollments'),
                DB::raw('COALESCE(SUM(enrollments.final_price), 0) as total_revenue')
            )
            ->leftJoin('subjects', 'departments.id', '=', 'subjects.department_id')
            ->leftJoin('courses', 'subjects.id', '=', 'courses.subject_id')
            ->leftJoin('enrollments', function ($join) {
                $join->on('courses.id', '=', 'enrollments.course_id')
                     ->where('enrollments.active', true);
            })
            ->groupBy('departments.id', 'departments.name', 'departments.color')
            ->orderByDesc('total_revenue')
            ->get();

        return response()->json(['departments' => $data]);
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Student registration growth (last 12 months)
    // GET /admin/dashboard/student-growth
    // ─────────────────────────────────────────────────────────────
    public function studentGrowth()
    {
        $growth = User::where('type', 'student')
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('COUNT(*) as new_students')
            )
            ->where('created_at', '>=', now()->subMonths(12)->startOfMonth())
            ->groupBy('year', 'month')
            ->orderBy('year')
            ->orderBy('month')
            ->get();

        return response()->json(['growth' => $growth]);
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Recent wallet transactions (last 30)
    // GET /admin/dashboard/recent-transactions
    // ─────────────────────────────────────────────────────────────
    public function recentTransactions()
    {
        $transactions = Transaction::with(['wallet.user:id,full_name,email,phone'])
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn ($t) => [
                'id'                 => $t->id,
                'transaction_number' => $t->transaction_number,
                'type'               => $t->type,
                'amount'             => $t->amount,
                'balance_before'     => $t->balance_before,
                'balance_after'      => $t->balance_after,
                'title'              => $t->title,
                'status'             => $t->status,
                'created_at'         => $t->created_at?->toDateTimeString(),
                'user'               => $t->wallet?->user?->only(['id', 'full_name', 'email', 'phone']),
            ]);

        return response()->json(['transactions' => $transactions]);
    }

    // ─────────────────────────────────────────────────────────────
    // 9. Coupon statistics
    // GET /admin/dashboard/coupon-stats
    // ─────────────────────────────────────────────────────────────
    public function couponStats()
    {
        $total   = Coupon::count();
        $active  = Coupon::where('active', true)->count();
        $expired = Coupon::where('active', true)
            ->where('valid_until', '<', now())
            ->count();

        $topCoupons = Coupon::select(
                'coupons.id',
                'coupons.code',
                'coupons.type',
                'coupons.value',
                'coupons.used_count',
                DB::raw('COALESCE(SUM(coupon_usages.discount_amount), 0) as total_saved')
            )
            ->leftJoin('coupon_usages', 'coupons.id', '=', 'coupon_usages.coupon_id')
            ->groupBy('coupons.id', 'coupons.code', 'coupons.type', 'coupons.value', 'coupons.used_count')
            ->orderByDesc('coupons.used_count')
            ->limit(10)
            ->get();

        $totalSaved = CouponUsage::sum('discount_amount');

        return response()->json([
            'summary' => [
                'total_coupons'   => $total,
                'active_coupons'  => $active,
                'expired_coupons' => $expired,
                'total_uses'      => CouponUsage::count(),
                'total_saved'     => $totalSaved,
            ],
            'top_coupons' => $topCoupons,
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    // 10. Support messages summary
    // GET /admin/dashboard/support
    // ─────────────────────────────────────────────────────────────
    public function support(Request $request)
    {
        $query = SupportMessage::with('user:id,full_name,email')->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $summary = SupportMessage::select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'summary'  => [
                'new'     => $summary['new']     ?? 0,
                'read'    => $summary['read']     ?? 0,
                'replied' => $summary['replied']  ?? 0,
                'total'   => array_sum($summary->toArray()),
            ],
            'messages' => $query->paginate($request->integer('limit', 20)),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    // 11. Update support message status
    // PUT /admin/dashboard/support/{id}/status
    // ─────────────────────────────────────────────────────────────
    public function updateSupportStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:new,read,replied',
        ]);

        $msg = SupportMessage::findOrFail($id);
        $msg->update(['status' => $request->status]);

        return response()->json(['message' => 'Status updated.', 'support_message' => $msg]);
    }
}
