<?php

namespace App\Support;

use App\Models\Course;
use App\Models\User;
use App\Services\NotificationService;

class InstructorAdminNotifier
{
    public static function notify(Course $course, string $body): void
    {
        $notificationService = app(NotificationService::class);
        $adminIds = User::where('type', 'admin')->pluck('id')->toArray();
        $name = auth()->user()?->full_name ?? 'معلم';
        foreach ($adminIds as $adminId) {
            $notificationService->sendToUser(
                $adminId,
                'كورس: '.$course->title,
                $body.' — '.$name,
                ['course_id' => $course->id, 'type' => 'instructor_course_activity']
            );
        }
    }
}
