<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CourseController extends Controller
{
    /**
     * Get my courses (same as index; explicit alias for clients).
     */
    public function myCourses()
    {
        return $this->index();
    }

    /**
     * Get my courses
     */
    public function index()
    {
        $courses = Course::where('instructor_id', auth()->id())
            ->with(['subject.department', 'subject.year', 'subject.semester', 'sections.lessons'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($courses);
    }

    /**
     * Search / filter my courses (not the public catalog — use catalog/search for that).
     */
    public function search(Request $request)
    {
        $query = Course::where('instructor_id', auth()->id())
            ->with(['subject.department', 'subject.year', 'subject.semester']);

        if ($request->filled('keyword')) {
            $k = $request->keyword;
            $query->where(fn ($q) => $q->where('title', 'like', "%{$k}%")
                ->orWhere('description', 'like', "%{$k}%"));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        return response()->json($query->latest()->paginate(min(50, max(5, (int) $request->get('per_page', 20)))));
    }

    /**
     * Subscribers / enrollments for a course (purchase rows).
     */
    public function subscriptions(Request $request, $courseId)
    {
        $course = Course::where('instructor_id', auth()->id())->findOrFail($courseId);

        $enrollments = Enrollment::where('course_id', $courseId)
            ->with(['student:id,full_name,email,phone,image'])
            ->orderByDesc('enrolled_at')
            ->paginate(min(100, max(5, (int) $request->get('per_page', 20))));

        return response()->json([
            'course'       => $course->only(['id', 'title', 'status', 'active', 'price', 'students_count']),
            'enrollments'  => $enrollments,
        ]);
    }

    /**
     * Create new course
     */
    public function store(Request $request)
    {
        $imageRule = $request->hasFile('image')
            ? ['nullable', 'image', 'max:5120']
            : ['nullable', 'string', 'max:500'];

        $request->validate([
            'subject_id' => 'required|exists:subjects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image' => $imageRule,
            'price' => 'required|numeric|min:0',
            'allow_section_purchase' => 'boolean',
            'allow_lesson_purchase' => 'boolean',
            'free_first_lesson' => 'boolean',
            'allow_instructor_contact' => 'boolean',
            'whatsapp_group_link' => 'nullable|string|max:500',
        ]);

        // التحقق من الصلاحيات
        $instructor = auth()->user();
        if (! $instructor->hasPermissionTo('create course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('courses', 'public');
        } elseif ($request->filled('image')) {
            $imagePath = $request->input('image');
        }

        $course = Course::create([
            'subject_id' => $request->subject_id,
            'instructor_id' => auth()->id(),
            'title' => $request->title,
            'description' => $request->description,
            'image' => $imagePath,
            'price' => $request->price,
            'allow_section_purchase' => $request->boolean('allow_section_purchase', false),
            'allow_lesson_purchase' => $request->boolean('allow_lesson_purchase', false),
            'free_first_lesson' => $request->boolean('free_first_lesson', false),
            'allow_instructor_contact' => $request->boolean('allow_instructor_contact', false),
            'whatsapp_group_link' => $request->input('whatsapp_group_link'),
            'status' => 'pending',
            'active' => false,
        ]);

        // إرسال إشعار للآدمن
        $notificationService = app(NotificationService::class);
        $adminIds = User::where('type', 'admin')->pluck('id')->toArray();
        foreach ($adminIds as $adminId) {
            $notificationService->sendToUser(
                $adminId,
                'كورس جديد ينتظر الموافقة',
                "قام الأستاذ {$instructor->full_name} بإنشاء كورس جديد بعنوان: {$course->title}",
                ['course_id' => $course->id, 'type' => 'course_approval']
            );
        }

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
        if (! auth()->user()->hasPermissionTo('edit course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $imageRule = $request->hasFile('image')
            ? ['nullable', 'image', 'max:5120']
            : ['nullable', 'string', 'max:500'];

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'image' => $imageRule,
            'price' => 'sometimes|numeric|min:0',
            'allow_section_purchase' => 'boolean',
            'allow_lesson_purchase' => 'boolean',
            'free_first_lesson' => 'boolean',
            'allow_instructor_contact' => 'boolean',
            'whatsapp_group_link' => 'nullable|string|max:500',
        ]);

        $data = $request->only([
            'title', 'description', 'price',
            'allow_section_purchase', 'allow_lesson_purchase', 'free_first_lesson',
            'whatsapp_group_link',
        ]);
        if ($request->has('allow_instructor_contact')) {
            $data['allow_instructor_contact'] = $request->boolean('allow_instructor_contact');
        }

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
     * Update WhatsApp group link only (nullable clears).
     */
    public function updateWhatsappLink(Request $request, $courseId)
    {
        $course = Course::where('instructor_id', auth()->id())->findOrFail($courseId);

        if (! auth()->user()->hasPermissionTo('edit course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'whatsapp_group_link' => 'nullable|string|max:500',
        ]);

        $course->update([
            'whatsapp_group_link' => $request->input('whatsapp_group_link'),
        ]);

        return response()->json([
            'message' => 'Updated',
            'course'  => $course->fresh(),
        ]);
    }

    /**
     * Get course statistics
     */
    public function stats($courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

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
}
