<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\Course;
use App\Models\Department;
use App\Models\Subject;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    /**
     * Get home page data (banners and departments)
     */
    public function home()
    {
        $banners = Banner::where('active', true)
            ->orderBy('order')
            ->get();

        $departments = Department::where('active', true)
            ->with(['years.semesters.subjects'])
            ->get();

        return response()->json([
            'banners' => $banners,
            'departments' => $departments,
        ]);
    }

    /**
     * Get departments
     */
    public function departments()
    {
        $departments = Department::where('active', true)
            ->with(['years.semesters.subjects'])
            ->get();

        return response()->json($departments);
    }

    /**
     * Get courses by subject
     */
    public function getCoursesBySubject(Request $request, $subjectId)
    {
        $subject = Subject::with(['courses.instructor', 'courses.sections.lessons'])
            ->findOrFail($subjectId);

        $courses = Course::where('subject_id', $subjectId)
            ->where('active', true)
            ->where('status', 'published')
            ->with(['instructor', 'sections.lessons'])
            ->get();

        return response()->json([
            'subject' => $subject,
            'courses' => $courses,
        ]);
    }

    /**
     * Get course details
     */
    public function show($courseId)
    {
        $course = Course::with([
            'instructor',
            'sections.lessons',
            'subject.department',
            'subject.year',
            'subject.semester',
        ])->findOrFail($courseId);

        $isEnrolled = auth()->user()->hasAccessToCourse($courseId);

        return response()->json([
            'course' => $course,
            'is_enrolled' => $isEnrolled,
            'students_count' => $course->students_count,
        ]);
    }

    /**
     * Search courses
     */
    public function search(Request $request)
    {
        $query = Course::where('active', true)
            ->where('status', 'published')
            ->with(['instructor', 'subject']);

        if ($request->has('keyword')) {
            $query->where('title', 'like', '%' . $request->keyword . '%');
        }

        if ($request->has('department_id')) {
            $query->whereHas('subject', function ($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }

        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        $courses = $query->paginate(20);

        return response()->json($courses);
    }
}
