<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Subject;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    /**
     * Get my courses
     */
    public function index()
    {
        $courses = Course::where('instructor_id', auth()->id())
            ->with(['subject', 'sections.lessons'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($courses);
    }

    /**
     * Create new course
     */
    public function store(Request $request)
    {
        $request->validate([
            'subject_id' => 'required|exists:subjects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'allow_section_purchase' => 'boolean',
            'allow_lesson_purchase' => 'boolean',
            'free_first_lesson' => 'boolean',
        ]);

        // التحقق من الصلاحيات
        $instructor = auth()->user();
        if (!$instructor->hasPermissionTo('create course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $course = Course::create([
            'subject_id' => $request->subject_id,
            'instructor_id' => auth()->id(),
            'title' => $request->title,
            'description' => $request->description,
            'price' => $request->price,
            'allow_section_purchase' => $request->allow_section_purchase ?? false,
            'allow_lesson_purchase' => $request->allow_lesson_purchase ?? false,
            'free_first_lesson' => $request->free_first_lesson ?? false,
            'status' => 'pending', // يحتاج موافقة الأدمن
            'active' => false,
        ]);

        return response()->json([
            'message' => 'Course created successfully. Waiting for admin approval.',
            'course' => $course,
        ], 201);
    }

    /**
     * Update course
     */
    public function update(Request $request, $courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('edit course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
        ]);

        $course->update($request->only(['title', 'description', 'price']));

        return response()->json([
            'message' => 'Course updated successfully',
            'course' => $course,
        ]);
    }

    /**
     * Get course statistics
     */
    public function stats($courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

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
}
