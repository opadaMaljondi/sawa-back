<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Setting;

/**
 * خصم إعادة الاشتراك بعد انتهاء دورة الكورس (نسبة من السعر الأساسي للعنصر).
 */
final class CourseRenewalDiscountService
{
    /**
     * مبلغ الخصم بالعملة (من السعر الأساسي قبل أي خصومات أخرى).
     */
    public function computeDiscountAmount(Course $course, int $studentId, float $baseListPrice): float
    {
        if ($baseListPrice <= 0) {
            return 0.0;
        }

        $pct = (float) Setting::get('expired_course_re_enrollment_discount_percent', 0);
        if ($pct <= 0) {
            return 0.0;
        }

        if (! $course->expires_at) {
            return 0.0;
        }

        // الكورس انتهت دورته (اليوم الحالي بعد يوم انتهاء expires_at)
        if (! $this->courseCycleHasEnded($course)) {
            return 0.0;
        }

        $hadPriorInactive = Enrollment::query()
            ->where('student_id', $studentId)
            ->where('course_id', $course->id)
            ->where('active', false)
            ->exists();

        if (! $hadPriorInactive) {
            return 0.0;
        }

        $pct = min(100.0, max(0.0, $pct));

        return round($baseListPrice * ($pct / 100.0), 2);
    }

    /**
     * انتهت الدورة: تاريخ الانتهاء قبل اليوم الحالي (يُعطّل الاشتراك صباح اليوم التالي ليوم الانتهاء).
     */
    public function courseCycleHasEnded(Course $course): bool
    {
        if (! $course->expires_at) {
            return false;
        }

        return $course->expires_at->toDateString() < now()->toDateString();
    }
}
