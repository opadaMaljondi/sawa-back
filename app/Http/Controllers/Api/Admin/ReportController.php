<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Course;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Get revenue report
     */
    public function revenue(Request $request)
    {
        $query = Enrollment::where('active', true)
            ->select(
                DB::raw('DATE(enrolled_at) as date'),
                DB::raw('COUNT(*) as enrollments'),
                DB::raw('SUM(final_price) as revenue'),
                DB::raw('SUM(discount) as discounts')
            )
            ->groupBy('date');

        if ($request->has('from')) {
            $query->where('enrolled_at', '>=', $request->from);
        }

        if ($request->has('to')) {
            $query->where('enrolled_at', '<=', $request->to);
        }

        $report = $query->orderBy('date', 'desc')->get();

        return response()->json($report);
    }

    /**
     * Get course performance report
     */
    public function coursePerformance()
    {
        $courses = Course::with(['instructor', 'subject'])
            ->select(
                'courses.*',
                DB::raw('COUNT(enrollments.id) as total_enrollments'),
                DB::raw('SUM(enrollments.final_price) as total_revenue')
            )
            ->leftJoin('enrollments', 'courses.id', '=', 'enrollments.course_id')
            ->where('enrollments.active', true)
            ->groupBy('courses.id')
            ->orderBy('total_revenue', 'desc')
            ->get();

        return response()->json($courses);
    }

    /**
     * Get instructor performance report
     */
    public function instructorPerformance()
    {
        $instructors = User::where('type', 'instructor')
            ->select(
                'users.*',
                DB::raw('COUNT(courses.id) as total_courses'),
                DB::raw('COUNT(enrollments.id) as total_enrollments'),
                DB::raw('SUM(enrollments.final_price) as total_revenue')
            )
            ->leftJoin('courses', 'users.id', '=', 'courses.instructor_id')
            ->leftJoin('enrollments', 'courses.id', '=', 'enrollments.course_id')
            ->where('enrollments.active', true)
            ->groupBy('users.id')
            ->orderBy('total_revenue', 'desc')
            ->get();

        return response()->json($instructors);
    }
}
