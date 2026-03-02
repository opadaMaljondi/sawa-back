<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\Course;
use App\Models\Department;
use App\Models\Enrollment;
use App\Models\Subject;
use Illuminate\Http\Request;

class CourseController extends Controller
{
    /**
     * Home page: banners, departments list, and student's active subscriptions.
     */
    public function home()
    {
        $user = auth()->user();

        $banners = Banner::where('active', true)
            ->orderBy('order')
            ->get();

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
            'banners'       => $banners,
            'departments'   => $departments,
            'subscriptions' => $subscriptions,
        ]);
    }

    /**
     * Get all departments (basic list).
     */
    public function departments()
    {
        $departments = Department::where('active', true)
            ->orderBy('order')
            ->get();

        return response()->json($departments);
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
            'year_id'     => 'required|exists:years,id',
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
                    'id'                => $course->id,
                    'title'             => $course->title,
                    'image'             => $course->image,
                    'instructor'        => $course->instructor
                        ? $course->instructor->only(['id', 'full_name', 'image'])
                        : null,
                    'price'             => $course->price,
                    'sections_count'    => $course->sections->count(),
                    'lessons_count'     => $course->lessons->count(),
                    'total_hours'       => round($totalMinutes / 60, 1),
                    'subscribers_count' => $course->students_count,
                ];
            });

        return response()->json(['courses' => $courses]);
    }

    /**
     * Get courses by subject.
     */
    public function getCoursesBySubject(Request $request, $subjectId)
    {
        $subject = Subject::findOrFail($subjectId);

        $courses = Course::approvedForStudents()
            ->where('subject_id', $subjectId)
            ->with([
                'instructor',
                'sections' => function ($q) {
                    $q->orderBy('order');
                },
                'sections.lessons' => function ($q) {
                    $q->approvedForStudents()->orderBy('order');
                },
            ])
            ->get();

        return response()->json([
            'subject' => $subject,
            'courses' => $courses,
        ]);
    }

    /**
     * Get course details.
     */
    public function show($courseId)
    {
        $course = Course::approvedForStudents()
            ->with([
                'instructor',
                'subject.department',
                'subject.year',
                'subject.semester',
                'sections' => function ($q) {
                    $q->orderBy('order');
                },
                'sections.lessons' => function ($q) {
                    $q->approvedForStudents()->orderBy('order');
                },
            ])
            ->find($courseId);

        if (!$course) {
            return response()->json(['message' => 'Course not found or not available.'], 404);
        }

        $isEnrolled = auth()->user()->hasAccessToCourse($courseId);

        return response()->json([
            'course'         => $course,
            'is_enrolled'    => $isEnrolled,
            'students_count' => $course->students_count,
        ]);
    }

    /**
     * Search courses.
     */
    public function search(Request $request)
    {
        $query = Course::approvedForStudents()
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
