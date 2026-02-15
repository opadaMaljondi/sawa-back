<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    /**
     * Get all courses
     */
    public function index(Request $request)
    {
        $query = Course::with(['instructor', 'subject', 'sections.lessons']);

        // فلترة وبحث
        if ($request->has('keyword')) {
            $query->where('title', 'like', '%' . $request->keyword . '%');
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('instructor_id')) {
            $query->where('instructor_id', $request->instructor_id);
        }

        $courses = $query->paginate(20);

        return response()->json($courses);
    }

    /**
     * Create course (as admin - لأي استاذ)
     */
    public function store(Request $request)
    {
        $request->validate([
            'instructor_id' => 'required|exists:users,id',
            'subject_id' => 'required|exists:subjects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:500',
            'price' => 'required|numeric|min:0',
            'allow_section_purchase' => 'boolean',
            'allow_lesson_purchase' => 'boolean',
            'free_first_lesson' => 'boolean',
            'status' => 'nullable|in:draft,pending,published',
            'active' => 'boolean',
        ]);

        $instructor = \App\Models\User::find($request->instructor_id);
        if ($instructor->type !== 'instructor') {
            return response()->json([
                'message' => 'The selected user is not an instructor. Use a user with type "instructor".',
            ], 422);
        }

        $course = Course::create([
            'instructor_id' => $request->instructor_id,
            'subject_id' => $request->subject_id,
            'title' => $request->title,
            'description' => $request->description ?? '',
            'image' => $request->image,
            'price' => $request->price,
            'allow_section_purchase' => $request->boolean('allow_section_purchase', false),
            'allow_lesson_purchase' => $request->boolean('allow_lesson_purchase', false),
            'free_first_lesson' => $request->boolean('free_first_lesson', false),
            'status' => $request->input('status', 'published'),
            'active' => $request->boolean('active', true),
        ]);

        return response()->json([
            'message' => 'Course created successfully',
            'course' => $course,
        ], 201);
    }

    /**
     * Update course (any course)
     */
    public function update(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'image' => 'nullable|string|max:500',
            'price' => 'sometimes|numeric|min:0',
            'allow_section_purchase' => 'boolean',
            'allow_lesson_purchase' => 'boolean',
            'free_first_lesson' => 'boolean',
            'status' => 'sometimes|in:draft,pending,published',
            'active' => 'sometimes|boolean',
        ]);

        $course->update($request->only([
            'title', 'description', 'image', 'price',
            'allow_section_purchase', 'allow_lesson_purchase', 'free_first_lesson',
            'status', 'active',
        ]));

        return response()->json([
            'message' => 'Course updated successfully',
            'course' => $course->fresh(),
        ]);
    }

    /**
     * Course statistics (any course)
     */
    public function stats($courseId)
    {
        $course = Course::findOrFail($courseId);

        $enrollments = \App\Models\Enrollment::where('course_id', $courseId)
            ->where('active', true)
            ->get();

        $stats = [
            'total_enrollments' => $enrollments->count(),
            'full_course_enrollments' => $enrollments->where('type', 'full_course')->count(),
            'section_enrollments' => $enrollments->where('type', 'section')->count(),
            'lesson_enrollments' => $enrollments->where('type', 'lesson')->count(),
            'total_revenue' => $enrollments->sum('final_price'),
            'total_discounts' => $enrollments->sum('discount'),
        ];

        return response()->json($stats);
    }

    /**
     * Get course details
     */
    public function show($courseId)
    {
        $course = Course::with([
            'instructor',
            'subject.department',
            'subject.year',
            'subject.semester',
            'sections.lessons',
            'enrollments.student',
            'notes',
            'exams.questions',
        ])->findOrFail($courseId);

        return response()->json($course);
    }

    /**
     * Approve course (status = published)
     */
    public function approve($courseId)
    {
        $course = Course::findOrFail($courseId);
        $course->update([
            'status' => 'published',
            'active' => true,
        ]);

        return response()->json(['message' => 'Course approved successfully']);
    }

    /**
     * Reject course (status = draft, active = false)
     */
    public function reject(Request $request, $courseId)
    {
        $request->validate([
            'reason' => 'nullable|string',
        ]);

        $course = Course::findOrFail($courseId);
        $course->update([
            'status' => 'draft',
            'active' => false,
        ]);

        return response()->json(['message' => 'Course rejected']);
    }

    /**
     * Suspend course
     */
    public function suspend($courseId)
    {
        $course = Course::findOrFail($courseId);
        $course->update(['active' => false]);

        return response()->json(['message' => 'Course suspended']);
    }

    /**
     * Activate course
     */
    public function activate($courseId)
    {
        $course = Course::findOrFail($courseId);
        $course->update(['active' => true]);

        return response()->json(['message' => 'Course activated']);
    }

    /**
     * Delete course
     */
    public function destroy($courseId)
    {
        $course = Course::findOrFail($courseId);
        $course->delete();

        return response()->json(['message' => 'Course deleted successfully']);
    }
}
