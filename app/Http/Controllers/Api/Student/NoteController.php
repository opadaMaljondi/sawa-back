<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class NoteController extends Controller
{
    /**
     * Get saved notes/files for courses the student is enrolled in.
     * Only returns free notes or notes the student has paid for (via course/section enrollment).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Get all course IDs the student is enrolled in
        $enrolledCourseIds = Enrollment::where('student_id', $user->id)
            ->where('active', true)
            ->pluck('course_id')
            ->unique();

        $notes = Note::where('active', true)
            ->whereIn('course_id', $enrolledCourseIds)
            ->with([
                'course:id,title,image,instructor_id',
                'course.instructor:id,full_name',
                'lesson:id,title',
            ])
            ->get()
            ->map(function ($note) {
                return [
                    'id'               => $note->id,
                    'title'            => $note->title,
                    'description'      => $note->description,
                    'file_name'        => $note->file_name,
                    'file_type'        => $note->file_type,
                    'file_size'        => $note->file_size,
                    'file_url'         => $note->file_path
                        ? (filter_var($note->file_path, FILTER_VALIDATE_URL)
                            ? $note->file_path
                            : Storage::disk('public')->url($note->file_path))
                        : null,
                    'is_free'          => $note->is_free,
                    'prevent_download' => $note->prevent_download,
                    'course'           => $note->course ? [
                        'id'         => $note->course->id,
                        'title'      => $note->course->title,
                        'image'      => $note->course->image,
                        'instructor' => $note->course->instructor?->only(['id', 'full_name']),
                    ] : null,
                    'lesson'           => $note->lesson
                        ? $note->lesson->only(['id', 'title'])
                        : null,
                ];
            });

        return response()->json(['notes' => $notes]);
    }
}
