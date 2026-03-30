<?php

namespace App\Services;

use App\Models\Course;

/**
 * Splits paid amount using the course admin commission percent (0–100).
 * Applies to full_course, section, lesson, and attachment purchases (same course row).
 */
final class CourseCommissionService
{
    /**
     * @return array{admin_commission_percent: float, platform_amount: float, instructor_amount: float}
     */
    public static function split(float $finalPrice, float $adminCommissionPercent): array
    {
        $pct = max(0.0, min(100.0, $adminCommissionPercent));
        $rate = $pct / 100.0;
        $platform = round($finalPrice * $rate, 2);
        $instructor = round($finalPrice - $platform, 2);

        return [
            'admin_commission_percent' => round($pct, 2),
            'platform_amount' => $platform,
            'instructor_amount' => $instructor,
        ];
    }

    /**
     * @return array{admin_commission_percent: float, platform_amount: float, instructor_amount: float}
     */
    public static function splitForCourse(Course $course, float $finalPrice): array
    {
        return self::split($finalPrice, (float) ($course->admin_commission ?? 0));
    }
}
