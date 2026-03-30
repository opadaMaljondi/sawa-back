<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\CourseCommissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CourseController extends Controller
{
    /**
     * Get all courses
     */
    public function index(Request $request)
    {
        $query = Course::with(['instructor', 'subject', 'sections.lessons']);

        if ($request->filled('keyword')) {
            $k = $request->keyword;
            $query->where(fn ($q) => $q->where('title', 'like', "%{$k}%")
                ->orWhere('description', 'like', "%{$k}%"));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('instructor_id')) {
            $query->where('instructor_id', $request->instructor_id);
        }

        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        if ($request->filled('department_id')) {
            $query->whereHas('subject', fn ($q) => $q->where('department_id', $request->department_id));
        }

        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        return response()->json($query->latest()->paginate(20));
    }

    /**
     * Create course (as admin - لأي استاذ)
     */
    public function store(Request $request)
    {
        $imageRule = $request->hasFile('image')
            ? ['nullable', 'image', 'max:5120']
            : ['nullable', 'string', 'max:500'];

        $request->validate([
            'instructor_id' => 'required|exists:users,id',
            'subject_id' => 'required|exists:subjects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image' => $imageRule,
            'price' => 'required|numeric|min:0',
            'admin_commission' => 'nullable|numeric|min:0|max:100',
            'allow_section_purchase' => 'boolean',
            'allow_lesson_purchase' => 'boolean',
            'free_first_lesson' => 'boolean',
            'status' => 'nullable|in:draft,pending,published',
            'active' => 'boolean',
        ]);

        $instructor = User::find($request->instructor_id);
        if ($instructor->type !== 'instructor') {
            return response()->json([
                'message' => 'The selected user is not an instructor. Use a user with type "instructor".',
            ], 422);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('courses', 'public');
        } elseif ($request->filled('image')) {
            $imagePath = $request->input('image');
        }

        $course = Course::create([
            'instructor_id' => $request->instructor_id,
            'subject_id' => $request->subject_id,
            'title' => $request->title,
            'description' => $request->description ?? '',
            'image' => $imagePath,
            'price' => $request->price,
            'admin_commission' => $request->input('admin_commission', 0),
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

        $imageRule = $request->hasFile('image')
            ? ['nullable', 'image', 'max:5120']
            : ['nullable', 'string', 'max:500'];

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'image' => $imageRule,
            'price' => 'sometimes|numeric|min:0',
            'admin_commission' => 'sometimes|nullable|numeric|min:0|max:100',
            'allow_section_purchase' => 'boolean',
            'allow_lesson_purchase' => 'boolean',
            'free_first_lesson' => 'boolean',
            'status' => 'sometimes|in:draft,pending,published',
            'active' => 'sometimes|boolean',
        ]);

        $data = $request->only([
            'title', 'description', 'price', 'admin_commission',
            'allow_section_purchase', 'allow_lesson_purchase', 'free_first_lesson',
            'status', 'active',
        ]);

        if ($request->hasFile('image')) {
            $oldPath = $course->getRawOriginal('image');
            if ($oldPath && ! filter_var($oldPath, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($oldPath);
            }
            $data['image'] = $request->file('image')->store('courses', 'public');
        } elseif ($request->has('image') && is_string($request->input('image'))) {
            $data['image'] = $request->input('image');
        }

        $course->update($data);

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

        $enrollments = Enrollment::where('course_id', $courseId)
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
     * Paginated enrollments (subscriptions) for this course with admin / teacher revenue split.
     */
    public function subscriptions(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);
        $commissionRate = (float) ($course->admin_commission ?? 0) / 100;

        $query = Enrollment::query()
            ->where('course_id', $courseId)
            ->with([
                'student:id,full_name,email',
                'section:id,title',
                'lesson:id,title',
                'note:id,title',
            ])
            ->orderByDesc('enrolled_at');

        $perPage = min(max($request->integer('per_page', 25), 5), 100);

        $paginator = $query->paginate($perPage);

        $paginator->through(function (Enrollment $e) use ($course, $commissionRate) {
            $final = (float) $e->final_price;
            if ($e->platform_amount !== null && $e->instructor_amount !== null) {
                $adminAmount = (float) $e->platform_amount;
                $teacherAmount = (float) $e->instructor_amount;
            } else {
                $adminAmount = round($final * $commissionRate, 2);
                $teacherAmount = round($final - $adminAmount, 2);
            }

            return [
                'id' => $e->id,
                'student' => $e->student,
                'type' => $e->type,
                'type_label' => $this->enrollmentTypeLabel($e->type),
                'item_title' => $this->enrollmentItemTitle($e, $course),
                'original_price' => (float) $e->original_price,
                'discount' => (float) $e->discount,
                'final_price' => $final,
                'admin_amount' => $adminAmount,
                'teacher_amount' => $teacherAmount,
                'active' => (bool) $e->active,
                'enrolled_at' => $e->enrolled_at?->toIso8601String(),
            ];
        });

        $activeRows = Enrollment::where('course_id', $courseId)
            ->where('active', true)
            ->get(['final_price', 'platform_amount', 'instructor_amount']);
        $totalFinal = 0.0;
        $totalAdmin = 0.0;
        $totalTeacher = 0.0;
        foreach ($activeRows as $e) {
            $totalFinal += (float) $e->final_price;
            if ($e->platform_amount !== null && $e->instructor_amount !== null) {
                $totalAdmin += (float) $e->platform_amount;
                $totalTeacher += (float) $e->instructor_amount;
            } else {
                $s = CourseCommissionService::splitForCourse($course, (float) $e->final_price);
                $totalAdmin += $s['platform_amount'];
                $totalTeacher += $s['instructor_amount'];
            }
        }
        $summary = [
            'admin_commission_percent' => (float) ($course->admin_commission ?? 0),
            'total_final_price' => round($totalFinal, 2),
            'total_admin_amount' => round($totalAdmin, 2),
            'total_teacher_amount' => round($totalTeacher, 2),
        ];

        $payload = $paginator->toArray();
        $payload['summary'] = $summary;

        return response()->json($payload);
    }

    private function enrollmentTypeLabel(string $type): string
    {
        return match ($type) {
            'full_course' => 'كورس كامل',
            'section' => 'وحدة',
            'lesson' => 'درس (فيديو)',
            'attachment', 'note' => 'ملف مرفق',
            default => $type,
        };
    }

    private function enrollmentItemTitle(Enrollment $e, Course $course): string
    {
        return match ($e->type) {
            'full_course' => $course->title,
            'section' => $e->section?->title ?? '—',
            'lesson' => $e->lesson?->title ?? '—',
            'attachment', 'note' => $e->note?->title ?? '—',
            default => '—',
        };
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
            'exams',
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
