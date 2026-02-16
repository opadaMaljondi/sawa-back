<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;

class InstructorController extends Controller
{
    /**
     * Get all instructors
     */
    public function index(Request $request)
    {
        $query = User::where('type', 'instructor')
            ->with(['courses']);

        // فلترة حسب القسم
        if ($request->has('department_id')) {
            $query->whereHas('courses.subject', function ($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }

        $instructors = $query->paginate(20);

        return response()->json($instructors);
    }

    /**
     * Create instructor
     */
    public function store(Request $request)
    {
        $request->validate([
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|unique:users,phone',
            'password' => 'required|string|min:6',
        ]);

        $instructor = User::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'type' => 'instructor',
        ]);

        $instructor->assignRole('instructor');

        return response()->json([
            'message' => 'Instructor created successfully',
            'instructor' => $instructor,
        ], 201);
    }

    /**
     * Get instructor details
     */
    public function show($instructorId)
    {
        $instructor = User::where('type', 'instructor')
            ->with(['courses.subject', 'courses.sections.lessons', 'permissions'])
            ->findOrFail($instructorId);

        return response()->json($instructor);
    }

    /**
     * Update instructor permissions
     */
    public function updatePermissions(Request $request, $instructorId)
    {
        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);

        $data = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string',
        ]);

        // إنشاء / تحديث صلاحيات على مستوى المستخدم مباشرة (ليس على مستوى الدور)
        // نستخدم حارس web دائماً لصلاحيات لوحة التحكم
        $guard = 'web';

        $permissionNames = [];
        foreach ($data['permissions'] as $name) {
            if (! $name) {
                continue;
            }

            Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => $guard],
                []
            );

            $permissionNames[] = $name;
        }

        // جلب كائنات Permission وربطها بالمستخدم مباشرة (model_has_permissions)
        $permissions = Permission::whereIn('name', $permissionNames)
            ->where('guard_name', $guard)
            ->get();

        $instructor->syncPermissions($permissions);

        return response()->json([
            'message' => 'Permissions updated successfully',
            'instructor' => $instructor->load('permissions'),
        ]);
    }

    /**
     * Suspend/Activate instructor
     */
    public function toggleSuspend($instructorId)
    {
        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);
        $instructor->update(['active' => !$instructor->active]);

        return response()->json([
            'message' => $instructor->active ? 'Instructor activated' : 'Instructor suspended',
            'instructor' => $instructor,
        ]);
    }

    /**
     * Create course for instructor
     */
    public function createCourse(Request $request, $instructorId)
    {
        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);

        $request->validate([
            'subject_id' => 'required|exists:subjects,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
        ]);

        $course = Course::create([
            'subject_id' => $request->subject_id,
            'instructor_id' => $instructor->id,
            'title' => $request->title,
            'description' => $request->description,
            'price' => $request->price,
            'status' => 'published',
            'active' => true,
        ]);

        return response()->json([
            'message' => 'Course created successfully',
            'course' => $course,
        ], 201);
    }
}
