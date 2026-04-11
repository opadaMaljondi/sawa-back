<?php

namespace App\Support;

use App\Models\CourseSection;
use App\Models\Exam;
use App\Models\Lesson;
use App\Models\Note;
use App\Services\NotificationService;

/**
 * إشعارات لمشتركي الكورس كاملاً عند نشر محتوى جديد.
 */
class FullCourseContentNotifier
{
    public static function lessonPublished(Lesson $lesson): void
    {
        if (! $lesson->isApprovedForStudents()) {
            return;
        }
        $lesson->loadMissing('course');
        $course = $lesson->course;
        if (! $course) {
            return;
        }
        app(NotificationService::class)->sendToFullCourseSubscribers(
            $course->id,
            'درس جديد',
            'تم نشر درس جديد «'.$lesson->title.'» في «'.$course->title.'».',
            [
                'content_kind' => 'new_video',
                'lesson_id' => (string) $lesson->id,
            ]
        );
    }

    public static function sectionCreated(CourseSection $section): void
    {
        $section->loadMissing('course');
        $course = $section->course;
        if (! $course) {
            return;
        }
        app(NotificationService::class)->sendToFullCourseSubscribers(
            $course->id,
            'وحدة جديدة',
            'تمت إضافة وحدة جديدة «'.$section->title.'» في «'.$course->title.'».',
            [
                'content_kind' => 'new_section',
                'section_id' => (string) $section->id,
            ]
        );
    }

    public static function examPublished(Exam $exam): void
    {
        if (! $exam->active) {
            return;
        }
        $exam->loadMissing('course');
        $course = $exam->course;
        if (! $course) {
            return;
        }
        app(NotificationService::class)->sendToFullCourseSubscribers(
            $course->id,
            'امتحان جديد',
            'تمت إضافة امتحان «'.$exam->title.'» في «'.$course->title.'».',
            [
                'content_kind' => 'new_exam',
                'exam_id' => (string) $exam->id,
            ]
        );
    }

    public static function notePublished(Note $note): void
    {
        if (! $note->active) {
            return;
        }
        $note->loadMissing('course');
        $course = $note->course;
        if (! $course) {
            return;
        }
        app(NotificationService::class)->sendToFullCourseSubscribers(
            $course->id,
            'مرفق جديد',
            'تمت إضافة مرفق «'.$note->title.'» في «'.$course->title.'».',
            [
                'content_kind' => 'new_note',
                'note_id' => (string) $note->id,
            ]
        );
    }
}
