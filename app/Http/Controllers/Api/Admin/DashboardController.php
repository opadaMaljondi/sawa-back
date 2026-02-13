<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get dashboard statistics
     */
    public function stats()
    {
        $stats = [
            'total_students' => User::where('type', 'student')->count(),
            'total_instructors' => User::where('type', 'instructor')->count(),
            'total_courses' => Course::count(),
            'active_courses' => Course::where('active', true)->where('status', 'published')->count(),
            'pending_courses' => Course::where('status', 'pending')->count(),
            'total_enrollments' => Enrollment::where('active', true)->count(),
            'total_revenue' => Enrollment::where('active', true)->sum('final_price'),
            'total_discounts' => Enrollment::where('active', true)->sum('discount'),
            'net_profit' => Enrollment::where('active', true)->sum('final_price') - Enrollment::where('active', true)->sum('discount'),
        ];

        // إحصائيات حسب الشهر
        $monthlyStats = Enrollment::where('active', true)
            ->select(
                DB::raw('YEAR(enrolled_at) as year'),
                DB::raw('MONTH(enrolled_at) as month'),
                DB::raw('COUNT(*) as enrollments'),
                DB::raw('SUM(final_price) as revenue')
            )
            ->groupBy('year', 'month')
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->limit(12)
            ->get();

        return response()->json([
            'stats' => $stats,
            'monthly_stats' => $monthlyStats,
        ]);
    }

    /**
     * Get top courses
     */
    public function topCourses()
    {
        $topCourses = Course::with(['instructor', 'subject'])
            ->orderBy('students_count', 'desc')
            ->limit(10)
            ->get();

        return response()->json($topCourses);
    }

    /**
     * Get recent enrollments
     */
    public function recentEnrollments()
    {
        $enrollments = Enrollment::with(['student', 'course'])
            ->orderBy('enrolled_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json($enrollments);
    }
}
