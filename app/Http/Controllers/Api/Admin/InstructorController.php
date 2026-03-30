<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\CourseCommissionService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;

class InstructorController extends Controller
{
    /**
     * Get all instructors (search + department + active).
     */
    public function index(Request $request)
    {
        $query = User::where('type', 'instructor')
            ->with(['courses']);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('full_name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%"));
        }

        if ($request->filled('department_id')) {
            $query->whereHas('courses.subject', function ($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }

        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        return response()->json($query->latest()->paginate(20));
    }

    /**
     * Create instructor
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|unique:users,phone',
            'password' => 'required|string|min:6',
            'bio' => 'nullable|string|max:5000',
            'active' => 'boolean',
            'image' => 'nullable|image|max:2048',
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('profiles', 'public');
        }

        $instructor = User::create([
            'full_name' => $data['full_name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'password' => Hash::make($data['password']),
            'bio' => $data['bio'] ?? null,
            'image' => $imagePath,
            'type' => 'instructor',
            'active' => $request->boolean('active', true),
        ]);

        $instructor->assignRole('instructor');

        return response()->json([
            'message' => 'Instructor created successfully',
            'instructor' => $instructor,
        ], 201);
    }

    /**
     * Update instructor profile (name, contact, bio, image, active).
     */
    public function update(Request $request, $instructorId)
    {
        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);

        $data = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$instructor->id,
            'phone' => 'nullable|string|unique:users,phone,'.$instructor->id,
            'password' => 'nullable|string|min:6',
            'bio' => 'nullable|string|max:5000',
            'active' => 'sometimes|boolean',
            'image' => 'nullable|image|max:2048',
        ]);

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        unset($data['image']);

        if ($request->hasFile('image')) {
            if ($instructor->image && ! filter_var($instructor->image, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($instructor->image);
            }
            $data['image'] = $request->file('image')->store('profiles', 'public');
        }

        $instructor->update($data);

        return response()->json([
            'message' => 'Instructor updated successfully',
            'instructor' => $instructor->fresh(),
        ]);
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
     * Paginated instructors with wallet balance + sales / teacher earnings (active enrollments).
     *
     * GET /admin/instructors/finance-summary?search=&page=
     */
    public function financeSummary(Request $request)
    {
        $query = User::where('type', 'instructor')
            ->with([
                'wallet',
                'courses' => fn ($q) => $q->select('id', 'instructor_id'),
            ]);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('full_name', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhere('phone', 'like', "%{$s}%");
            });
        }

        $perPage = min($request->integer('per_page', 20), 100);
        $paginator = $query->orderBy('full_name')->paginate($perPage);
        $instructorIds = $paginator->getCollection()->pluck('id');

        if ($instructorIds->isEmpty()) {
            return response()->json($paginator);
        }

        $courses = Course::whereIn('instructor_id', $instructorIds)->get(['id', 'instructor_id', 'admin_commission']);
        $courseIds = $courses->pluck('id');
        $courseById = $courses->keyBy('id');

        $enrollments = $courseIds->isEmpty()
            ? collect()
            : Enrollment::whereIn('course_id', $courseIds)
                ->where('active', true)
                ->get(['course_id', 'final_price', 'platform_amount', 'instructor_amount']);

        $statsByInstructor = [];
        foreach ($instructorIds as $iid) {
            $statsByInstructor[$iid] = [
                'total_sales' => 0.0,
                'teacher_earnings' => 0.0,
                'enrollment_count' => 0,
            ];
        }

        foreach ($enrollments as $enrollment) {
            $course = $courseById->get($enrollment->course_id);
            if (! $course) {
                continue;
            }
            $iid = $course->instructor_id;
            $teacher = $enrollment->instructor_amount !== null
                ? (float) $enrollment->instructor_amount
                : CourseCommissionService::splitForCourse(
                    $course,
                    (float) $enrollment->final_price
                )['instructor_amount'];
            $statsByInstructor[$iid]['total_sales'] += (float) $enrollment->final_price;
            $statsByInstructor[$iid]['teacher_earnings'] += $teacher;
            $statsByInstructor[$iid]['enrollment_count']++;
        }

        $paginator->through(function (User $u) use ($statsByInstructor) {
            $s = $statsByInstructor[$u->id] ?? [
                'total_sales' => 0.0,
                'teacher_earnings' => 0.0,
                'enrollment_count' => 0,
            ];

            return [
                'id' => $u->id,
                'full_name' => $u->full_name,
                'email' => $u->email,
                'phone' => $u->phone,
                'active' => (bool) $u->active,
                'wallet_balance' => $u->wallet ? (float) $u->wallet->balance : 0.0,
                'wallet_currency' => $u->wallet?->currency ?? 'SYP',
                'courses_count' => $u->courses->count(),
                'total_sales' => round($s['total_sales'], 2),
                'teacher_earnings' => round($s['teacher_earnings'], 2),
                'enrollment_count' => $s['enrollment_count'],
            ];
        });

        return response()->json($paginator);
    }

    /**
     * Instructor wallet balance, recent transactions, and per-course teacher earnings (from enrollments × admin commission).
     *
     * GET /admin/instructors/{instructorId}/wallet-overview
     */
    public function walletOverview($instructorId)
    {
        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);

        $wallet = Wallet::firstOrCreate(
            ['user_id' => $instructor->id],
            [
                'balance' => 0,
                'currency' => 'SYP',
                'total_deposited' => 0,
                'total_spent' => 0,
                'active' => true,
            ]
        );

        $transactions = Transaction::where('wallet_id', $wallet->id)
            ->latest()
            ->limit(30)
            ->get();

        $courses = Course::where('instructor_id', $instructor->id)
            ->with('subject:id,name')
            ->orderByDesc('updated_at')
            ->get(['id', 'subject_id', 'title', 'price', 'status', 'active', 'admin_commission']);

        $courseIds = $courses->pluck('id')->all();
        $enrollments = $courseIds === []
            ? collect()
            : Enrollment::whereIn('course_id', $courseIds)
                ->where('active', true)
                ->get(['id', 'course_id', 'final_price', 'platform_amount', 'instructor_amount']);

        $earningsByCourseId = [];
        foreach ($enrollments as $enrollment) {
            $course = $courses->firstWhere('id', $enrollment->course_id);
            if (! $course) {
                continue;
            }
            $teacher = $enrollment->instructor_amount !== null
                ? (float) $enrollment->instructor_amount
                : CourseCommissionService::splitForCourse(
                    $course,
                    (float) $enrollment->final_price
                )['instructor_amount'];
            $cid = $course->id;
            if (! isset($earningsByCourseId[$cid])) {
                $earningsByCourseId[$cid] = [
                    'teacher_earnings' => 0.0,
                    'total_sales' => 0.0,
                    'enrollment_count' => 0,
                ];
            }
            $earningsByCourseId[$cid]['teacher_earnings'] += $teacher;
            $earningsByCourseId[$cid]['total_sales'] += (float) $enrollment->final_price;
            $earningsByCourseId[$cid]['enrollment_count']++;
        }

        $coursesPayload = $courses->map(function (Course $c) use ($earningsByCourseId) {
            $agg = $earningsByCourseId[$c->id] ?? [
                'teacher_earnings' => 0.0,
                'total_sales' => 0.0,
                'enrollment_count' => 0,
            ];

            return [
                'id' => $c->id,
                'title' => $c->title,
                'price' => $c->price,
                'status' => $c->status,
                'active' => (bool) $c->active,
                'admin_commission_percent' => (float) ($c->admin_commission ?? 0),
                'subject' => $c->subject,
                'teacher_earnings' => round($agg['teacher_earnings'], 2),
                'total_sales' => round($agg['total_sales'], 2),
                'enrollment_count' => $agg['enrollment_count'],
            ];
        });

        $totalSales = array_sum(array_column($earningsByCourseId, 'total_sales'));
        $totalTeacher = array_sum(array_column($earningsByCourseId, 'teacher_earnings'));

        return response()->json([
            'wallet' => $wallet,
            'transactions' => $transactions,
            'courses' => $coursesPayload,
            'totals' => [
                'total_sales' => round($totalSales, 2),
                'total_teacher_earnings' => round($totalTeacher, 2),
            ],
        ]);
    }

    /**
     * Adjust instructor wallet (deposit / withdraw / refund) — same rules as student wallet.
     *
     * POST /admin/instructors/{instructorId}/wallet
     */
    public function updateWallet(Request $request, $instructorId)
    {
        $request->validate([
            'type' => 'required|in:deposit,withdraw,refund',
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:500',
        ]);

        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);
        $walletService = app(WalletService::class);
        $noteText = $request->note ?? 'Admin adjustment';
        $meta = ['admin_id' => auth()->id(), 'note' => $request->note, 'target' => 'instructor_wallet'];

        if ($request->type === 'deposit') {
            $walletService->deposit($instructor->id, (float) $request->amount, "إيداع: {$noteText}", $meta);
        } elseif ($request->type === 'refund') {
            $walletService->refund($instructor->id, (float) $request->amount, "استرداد: {$noteText}", $meta);
        } else {
            try {
                $walletService->withdraw($instructor->id, (float) $request->amount, "سحب: {$noteText}", $meta);
            } catch (\InvalidArgumentException) {
                return response()->json(['message' => 'Insufficient balance.'], 400);
            }
        }

        return response()->json([
            'message' => 'Wallet updated successfully.',
            'wallet' => Wallet::where('user_id', $instructor->id)->first(),
        ]);
    }

    /**
     * Suspend/Activate instructor
     */
    public function toggleSuspend($instructorId)
    {
        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);
        $instructor->update(['active' => ! $instructor->active]);

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

    /**
     * Delete instructor
     */
    public function destroy($instructorId)
    {
        $instructor = User::where('type', 'instructor')->findOrFail($instructorId);
        $instructor->delete();

        return response()->json([
            'message' => 'Instructor deleted successfully',
        ]);
    }
}
