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
            ['course_id' => (string) $course->id, 'type' => 'instructor_course_activity'],
            $data
        );
        $activityType = $payload['type'] ?? 'instructor_course_activity';
        if (! isset($payload['admin_nav'])) {
            $payload['admin_nav'] = $activityType === 'course_approval'
                ? 'courses_list'
                : 'course_detail';
        }
        foreach (['lesson_id', 'note_id', 'exam_id', 'section_id'] as $idKey) {
            if (array_key_exists($idKey, $payload) && $payload[$idKey] !== null) {
                $payload[$idKey] = (string) $payload[$idKey];
            }
        }

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
