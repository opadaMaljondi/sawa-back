<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\CourseCommissionService;
use Illuminate\Http\JsonResponse;

class EarningsController extends Controller
{
    /**
     * أرباح المعلّم من اشتراكات كورساته (اشتراكات نشطة فقط).
     *
     * يعيد إجمالي حصة المعلّم وإجمالي المبيعات (السعر النهائي) وحصة المنصة،
     * ثم تفصيلاً لكل كورس يملكه المعلّم الحالي.
     */
    public function index(): JsonResponse
    {
        $instructorId = auth()->id();

        $courses = Course::query()
            ->where('instructor_id', $instructorId)
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'admin_commission']);

        $byCourse = [];
        foreach ($courses as $course) {
            $byCourse[$course->id] = [
                'course_id' => $course->id,
                'title' => $course->title,
                'instructor_profit' => 0.0,
                'gross_revenue' => 0.0,
                'platform_amount' => 0.0,
                'active_enrollments_count' => 0,
            ];
        }

        if ($courses->isEmpty()) {
            return response()->json([
                'summary' => [
                    'total_instructor_profit' => 0.0,
                    'total_gross_revenue' => 0.0,
                    'total_platform_amount' => 0.0,
                    'active_enrollments_count' => 0,
                ],
                'courses' => [],
            ]);
        }

        $courseIds = $courses->modelKeys();

        $enrollments = Enrollment::query()
            ->whereIn('course_id', $courseIds)
            ->where('active', true)
            ->with(['course:id,title,admin_commission'])
            ->get(['id', 'course_id', 'final_price', 'platform_amount', 'instructor_amount']);

        foreach ($enrollments as $enrollment) {
            $course = $enrollment->course;
            if (! $course || ! isset($byCourse[$enrollment->course_id])) {
                continue;
            }

            $final = (float) $enrollment->final_price;
            if ($enrollment->platform_amount !== null && $enrollment->instructor_amount !== null) {
                $platform = (float) $enrollment->platform_amount;
                $instructor = (float) $enrollment->instructor_amount;
            } else {
                $split = CourseCommissionService::splitForCourse($course, $final);
                $platform = $split['platform_amount'];
                $instructor = $split['instructor_amount'];
            }

            $cid = $enrollment->course_id;
            $byCourse[$cid]['instructor_profit'] += $instructor;
            $byCourse[$cid]['gross_revenue'] += $final;
            $byCourse[$cid]['platform_amount'] += $platform;
            $byCourse[$cid]['active_enrollments_count']++;
        }

        $coursesPayload = array_values($byCourse);

        $summary = [
            'total_instructor_profit' => round(array_sum(array_column($coursesPayload, 'instructor_profit')), 2),
            'total_gross_revenue' => round(array_sum(array_column($coursesPayload, 'gross_revenue')), 2),
            'total_platform_amount' => round(array_sum(array_column($coursesPayload, 'platform_amount')), 2),
            'active_enrollments_count' => array_sum(array_column($coursesPayload, 'active_enrollments_count')),
        ];

        foreach ($coursesPayload as &$row) {
            $row['instructor_profit'] = round($row['instructor_profit'], 2);
            $row['gross_revenue'] = round($row['gross_revenue'], 2);
            $row['platform_amount'] = round($row['platform_amount'], 2);
        }
        unset($row);

        return response()->json([
            'summary' => $summary,
            'courses' => $coursesPayload,
        ]);
    }
}
