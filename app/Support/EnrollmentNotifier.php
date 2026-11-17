<?php

namespace App\Support;

use App\Models\Enrollment;
use App\Models\User;
use App\Services\NotificationService;

class EnrollmentNotifier
{
    public static function notify(Enrollment $enrollment): void
    {
        $enrollment->loadMissing(['course', 'student']);
        $course = $enrollment->course;
        $student = $enrollment->student;
        if (! $course || ! $student) {
            return;
        }

        $service = app(NotificationService::class);
        $title = 'اشتراك جديد';
        $body = "قام الطالب {$student->full_name} بالاشتراك في: {$course->title}";
        $payload = [
            'course_id' => (int) $course->id,
            'student_id' => (int) $student->id,
            'enrollment_id' => (int) $enrollment->id,
            'type' => 'new_enrollment',
        ];

        $recipientIds = User::query()
            ->where('type', 'admin')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($course->instructor_id) {
            $recipientIds[] = (int) $course->instructor_id;
        }

        foreach (array_unique($recipientIds) as $userId) {
            $service->sendToUser($userId, $title, $body, $payload);
        }
    }
}
