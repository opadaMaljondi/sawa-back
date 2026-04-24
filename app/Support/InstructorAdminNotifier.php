<?php

namespace App\Support;

use App\Models\Course;
use App\Models\User;
use App\Services\FirebaseService;
use App\Services\NotificationService;

class InstructorAdminNotifier
{
    /**
     * @param  array<string, mixed>  $data  Merged with course_id and default type (overridable e.g. course_approval)
     */
    public static function notify(Course $course, string $body, ?string $title = null, array $data = []): void
    {
        $notificationService = app(NotificationService::class);
        $firebase = app(FirebaseService::class);
        $adminIds = User::where('type', 'admin')->pluck('id')->toArray();
        $name = auth()->user()?->full_name ?? 'معلم';
        $effectiveTitle = $title ?? ('كورس: '.$course->title);
        $message = $body.' — '.$name;
        $payload = array_merge(
            ['course_id' => $course->id, 'type' => 'instructor_course_activity'],
            $data
        );

        foreach ($adminIds as $adminId) {
            $notificationService->sendToUser(
                $adminId,
                $effectiveTitle,
                $message,
                $payload
            );
        }

        $firebase->pushAdminPendingReview($effectiveTitle, $message, $payload);
    }
}
