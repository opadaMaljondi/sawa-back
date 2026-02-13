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
            'attachments',
            'exams.questions',
        ])->findOrFail($courseId);

        return response()->json($course);
    }

    /**
     * Approve course
     */
    public function approve($courseId)
    {
        $course = Course::findOrFail($courseId);
        $course->update([
            'status' => 'published',
            'active' => true,
            'is_approved' => true,
        ]);

        return response()->json(['message' => 'Course approved successfully']);
    }

    /**
     * Reject course
     */
    public function reject(Request $request, $courseId)
    {
        $request->validate([
            'reason' => 'nullable|string',
        ]);

        $course = Course::findOrFail($courseId);
        $course->update([
            'status' => 'rejected',
            'active' => false,
            'is_approved' => false,
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
     * Set course expiry date
     */
    public function setExpiry(Request $request, $courseId)
    {
        $request->validate([
            'ends_at' => 'required|date|after:today',
        ]);

        $course = Course::findOrFail($courseId);
        $course->update(['ends_at' => $request->ends_at]);

        return response()->json(['message' => 'Course expiry date set']);
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
