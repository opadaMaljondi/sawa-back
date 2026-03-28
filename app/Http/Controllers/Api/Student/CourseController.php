<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\Course;
use App\Models\Department;
use App\Models\Enrollment;
use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CourseController extends Controller
{
    /**
     * Home page: banners, departments list, and student's active subscriptions.
     */
    public function home()
    {
        $user = auth()->user();

        $banners = Banner::where('active', true)->orderBy('order')->get();

        $departments = Department::where('active', true)
            ->select('id', 'name', 'name_en', 'icon', 'color', 'order')
            ->orderBy('order')
            ->get();

        $subscriptions = Enrollment::where('student_id', $user->id)
            ->where('active', true)
            ->with([
                'course:id,title,image,price,students_count',
                'course.instructor:id,full_name,image',
                'course.subject:id,name,department_id',
            ])
            ->latest('enrolled_at')
            ->get();

        return response()->json([
            'banners' => $banners,
            'departments' => $departments,
            'subscriptions' => $subscriptions,
        ]);
    }

    /**
     * Get all departments (basic list).
     */
    public function departments()
    {
        return response()->json(
            Department::where('active', true)->orderBy('order')->get()
        );
    }

    /**
     * Get department details with its years and semesters.
     */
    public function departmentShow($id)
    {
        $department = Department::where('active', true)
            ->with([
                'years' => fn ($q) => $q->where('active', true)->orderBy('order')
                    ->with([
                        'semesters' => fn ($q2) => $q2->where('active', true)->orderBy('order'),
                    ]),
            ])
            ->findOrFail($id);

        return response()->json($department);
    }

    /**
     * Get courses for a department filtered by year and semester.
     * Query params: year_id, semester_id
     */
    public function coursesByYearAndSemester(Request $request, $departmentId)
    {
        $request->validate([
            'year_id' => 'required|exists:years,id',
            'semester_id' => 'required|exists:semesters,id',
        ]);

        $subjectIds = Subject::where('department_id', $departmentId)
            ->where('year_id', $request->year_id)
            ->where('semester_id', $request->semester_id)
            ->where('active', true)
            ->pluck('id');

        $courses = Course::approvedForStudents()
            ->whereIn('subject_id', $subjectIds)
            ->with([
                'instructor:id,full_name,image',
                'sections:id,course_id',
                'lessons:id,course_id,section_id,duration',
            ])
            ->get()
            ->map(function ($course) {
                $totalMinutes = $course->lessons->sum('duration');

                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'image' => $course->image,
                    'instructor' => $course->instructor
                        ? $course->instructor->only(['id', 'full_name', 'image'])
                        : null,
                    'price' => $course->price,
                    'sections_count' => $course->sections->count(),
                    'lessons_count' => $course->lessons->count(),
                    'total_hours' => round($totalMinutes / 60, 1),
                    'subscribers_count' => $course->students_count,
                ];
            });

        return response()->json(['courses' => $courses]);
    }

    /**
     * Full course details for the student.
     *
     * Returns:
     *  - course info + instructor (with specialty, bio, phone)
     *  - sections with lessons (access-controlled video URL per lesson)
     *  - files/notes (access-controlled download URL)
     *  - exams (only for full-course enrollees)
     *  - text notes (title + description)
     */
    public function show($courseId)
    {
        $course = Course::approvedForStudents()
            ->with([
                'instructor:id,full_name,image,specialty,bio,phone',
                'subject:id,name,department_id,year_id,semester_id',
                'subject.department:id,name',
                'subject.year:id,name',
                'subject.semester:id,name',
                'sections' => fn ($q) => $q->orderBy('order'),
                'sections.lessons' => fn ($q) => $q->approvedForStudents()->orderBy('order'),
                'notes' => fn ($q) => $q->where('active', true),
                'exams' => fn ($q) => $q->where('active', true),
            ])
            ->find($courseId);

        if (! $course) {
            return response()->json(['message' => 'Course not found or not available.'], 404);
        }

        $student = auth()->user();

        // Load all enrollments for this course in one query to avoid N+1
        $enrollments = Enrollment::where('student_id', $student->id)
            ->where('course_id', $courseId)
            ->where('active', true)
            ->get();

        $hasFullCourse = $enrollments->where('type', 'full_course')->isNotEmpty();
        $enrolledSectionIds = $enrollments->where('type', 'section')->pluck('section_id')->all();
        $enrolledLessonIds = $enrollments->where('type', 'lesson')->pluck('lesson_id')->all();
        $enrolledNoteIds = Enrollment::where('student_id', $student->id)
            ->where('type', 'attachment')->where('active', true)->pluck('note_id')->all();

        // ----- Course summary -----
        $totalMinutes = $course->lessons->sum('duration');

        $courseData = [
            'id' => $course->id,
            'title' => $course->title,
            'description' => $course->description,
            'image' => $course->image,
            'price' => $course->price,
            'rating' => $course->rating,
            'reviews_count' => $course->reviews_count,
            'students_count' => $course->students_count,
            'allow_section_purchase' => $course->allow_section_purchase,
            'allow_lesson_purchase' => $course->allow_lesson_purchase,
            'sections_count' => $course->sections->count(),
            'lessons_count' => $course->lessons->count(),
            'total_hours' => round($totalMinutes / 60, 1),
            'subject' => $course->subject,
        ];

        // ----- Instructor -----
        $instructor = null;
        if ($course->instructor) {
            $instructor = [
                'id' => $course->instructor->id,
                'full_name' => $course->instructor->full_name,
                'image' => $course->instructor->image,
                'specialty' => $course->instructor->specialty,
                'bio' => $course->instructor->bio,
                'phone' => $course->instructor->phone,
            ];
        }

        // ----- Sections with lessons -----
        $sections = $course->sections->map(function ($section) use (
            $course, $hasFullCourse, $enrolledSectionIds, $enrolledLessonIds
        ) {
            $sectionAccessible = $hasFullCourse || in_array($section->id, $enrolledSectionIds);

            $lessons = $section->lessons->map(function ($lesson) use (
                $course, $hasFullCourse, $sectionAccessible, $enrolledLessonIds
            ) {
                $lessonAccessible = $lesson->is_free
                    || $hasFullCourse
                    || $sectionAccessible
                    || in_array($lesson->id, $enrolledLessonIds);

                return [
                    'id' => $lesson->id,
                    'title' => $lesson->title,
                    'description' => $lesson->description,
                    'thumbnail' => $lesson->thumbnail,
                    'duration' => $lesson->duration,
                    'order' => $lesson->order,
                    'price' => $lesson->price,
                    'is_free' => $lesson->is_free,
                    'can_download' => $lesson->can_download,
                    'can_purchase_alone' => (bool) $course->allow_lesson_purchase,
                    'is_accessible' => $lessonAccessible,
                    'video_provider' => $lesson->video_provider,
                    // Only expose playback URL if student has access
                    'video_playback_url' => $lessonAccessible ? $lesson->video_playback_url : null,
                ];
            });

            return [
                'id' => $section->id,
                'title' => $section->title,
                'description' => $section->description,
                'order' => $section->order,
                'price' => $section->price,
                'can_purchase_alone' => (bool) $course->allow_section_purchase,
                'is_accessible' => $sectionAccessible,
                'lessons' => $lessons,
            ];
        });

        // ----- Attachments (files/notes) -----
        $attachments = [];

        foreach ($course->notes as $note) {
            $noteAccessible = $note->is_free || $hasFullCourse || in_array($note->id, $enrolledNoteIds);

            $fileUrl = null;
            if ($noteAccessible && $note->file_path) {
                $fileUrl = filter_var($note->file_path, FILTER_VALIDATE_URL)
                    ? $note->file_path
                    : Storage::disk('public')->url($note->file_path);
            }

            $attachments[] = [
                'id' => $note->id,
                'title' => $note->title,
                'description' => $note->description,
                'file_name' => $note->file_name,
                'file_type' => $note->file_type,
                'file_size' => $note->file_size,
                'price' => $note->price,
                'is_free' => $note->is_free,
                'prevent_download' => $note->prevent_download,
                'can_purchase_alone' => ! $note->is_free && $note->price > 0,
                'is_accessible' => $noteAccessible,
                'file_url' => $fileUrl,
            ];
        }

        // ----- Exams — only for full-course enrolled students -----
        $exams = [];
        if ($hasFullCourse) {
            foreach ($course->exams as $exam) {
                $fileUrl = null;
                if ($exam->attachment) {
                    $fileUrl = filter_var($exam->attachment, FILTER_VALIDATE_URL)
                        ? $exam->attachment
                        : Storage::disk('public')->url($exam->attachment);
                }
                $exams[] = [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'description' => $exam->description,
                    'attachment_url' => $fileUrl,
                    'available_from' => $exam->available_from?->toDateTimeString(),
                    'available_until' => $exam->available_until?->toDateTimeString(),
                ];
            }
        }

        return response()->json([
            'course' => $courseData,
            'instructor' => $instructor,
            'is_enrolled' => $hasFullCourse,
            'sections' => $sections,
            'attachments' => $attachments,
            'exams' => $exams,
        ]);
    }

    /**
     * Get courses by subject.
     */
    public function getCoursesBySubject($subjectId)
    {
        $subject = Subject::findOrFail($subjectId);

        $courses = Course::approvedForStudents()
            ->where('subject_id', $subjectId)
            ->with([
                'instructor:id,full_name,image',
                'sections' => fn ($q) => $q->orderBy('order'),
                'sections.lessons' => fn ($q) => $q->approvedForStudents()->orderBy('order'),
            ])
            ->get();

        return response()->json(['subject' => $subject, 'courses' => $courses]);
    }

    /**
     * Search courses.
     */
    public function search(Request $request)
    {
        $query = Course::approvedForStudents()->with(['instructor', 'subject']);

        if ($request->has('keyword')) {
            $query->where('title', 'like', '%'.$request->keyword.'%');
        }

        if ($request->has('department_id')) {
            $query->whereHas('subject', fn ($q) => $q->where('department_id', $request->department_id));
        }

        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        return response()->json($query->paginate(20));
    }
}
