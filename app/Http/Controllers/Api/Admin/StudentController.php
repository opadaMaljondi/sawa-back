<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Models\Wallet;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class StudentController extends Controller
{
    /**
     * List all students with filters and search.
     */
    public function index(Request $request)
    {
        $query = User::where('type', 'student')->with(['wallet', 'department:id,name', 'year:id,name']);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('full_name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%"));
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->filled('year_id')) {
            $query->where('year_id', $request->year_id);
        }

        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        return response()->json($query->latest()->paginate(20));
    }

    /**
     * Create a new student account.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|unique:users,phone',
            'password' => 'required|string|min:6',
            'department_id' => 'nullable|exists:departments,id',
            'year_id' => 'nullable|exists:years,id',
            'active' => 'boolean',
            'image' => 'nullable|image|max:2048',
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('profiles', 'public');
        }

        $student = User::create([
            'full_name' => $data['full_name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => Hash::make($data['password']),
            'department_id' => $data['department_id'] ?? null,
            'year_id' => $data['year_id'] ?? null,
            'image' => $imagePath,
            'type' => 'student',
            'active' => $request->boolean('active', true),
        ]);

        $student->assignRole('student');

        $student->wallet()->create([
            'balance' => 0,
            'currency' => 'SYP',
            'total_deposited' => 0,
            'total_spent' => 0,
            'active' => true,
        ]);

        return response()->json([
            'message' => 'Student created successfully.',
            'student' => $student->load('wallet'),
        ], 201);
    }

    /**
     * Minimal student payload for wallet QR scan UI (no enrollments — avoids heavy / broken eager loads).
     */
    public function walletQrPreview($studentId)
    {
        $student = User::where('type', 'student')
            ->with('wallet')
            ->findOrFail($studentId);

        return response()->json($student);
    }

    /**
     * Student details with enrollments and wallet.
     */
    public function show($studentId)
    {
        $student = User::where('type', 'student')
            ->with([
                'department:id,name',
                'year:id,name',
                'wallet.transactions' => fn ($q) => $q->latest()->limit(500),
                'enrollments' => fn ($q) => $q->with([
                    'course:id,title,price',
                    'section:id,title',
                    'lesson:id,title',
                    'note:id,title',
                ])->latest('enrolled_at'),
            ])
            ->findOrFail($studentId);

        return response()->json($student);
    }

    /**
     * Update student info.
     */
    public function update(Request $request, $studentId)
    {
        $student = User::where('type', 'student')->findOrFail($studentId);

        $data = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,'.$student->id,
            'phone' => 'nullable|string|unique:users,phone,'.$student->id,
            'password' => 'nullable|string|min:6',
            'department_id' => 'nullable|exists:departments,id',
            'year_id' => 'nullable|exists:years,id',
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
            if ($student->image && ! filter_var($student->image, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($student->image);
            }
            $data['image'] = $request->file('image')->store('profiles', 'public');
        }

        $student->update($data);

        return response()->json([
            'message' => 'Student updated successfully.',
            'student' => $student->fresh(['wallet', 'department', 'year']),
        ]);
    }

    /**
     * Manually enroll student (free or paid, bypasses wallet).
     */
    public function enrollStudent(Request $request, $studentId)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'type' => 'required|in:full_course,section,lesson,attachment',
            'section_id' => 'nullable|exists:course_sections,id',
            'lesson_id' => 'nullable|exists:lessons,id',
            'note_id' => 'nullable|exists:notes,id',
            'free' => 'boolean',
        ]);

        $student = User::where('type', 'student')->findOrFail($studentId);
        $course = Course::findOrFail($request->course_id);

        $exists = Enrollment::where('student_id', $student->id)
            ->where('course_id', $course->id)
            ->where('type', $request->type)
            ->where('active', true)
            ->when($request->type === 'section', fn ($q) => $q->where('section_id', $request->section_id))
            ->when($request->type === 'lesson', fn ($q) => $q->where('lesson_id', $request->lesson_id))
            ->when($request->type === 'attachment', fn ($q) => $q->where('note_id', $request->note_id))
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Student is already enrolled.'], 422);
        }

        $originalPrice = (float) $course->price;

        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'type' => $request->type,
            'section_id' => $request->section_id ?? null,
            'lesson_id' => $request->lesson_id ?? null,
            'note_id' => $request->note_id ?? null,
            'original_price' => $originalPrice,
            'discount' => $request->boolean('free') ? $originalPrice : 0,
            'final_price' => $request->boolean('free') ? 0 : $originalPrice,
            'active' => true,
            'enrolled_at' => now(),
        ]);

        if ($request->type === 'full_course') {
            $course->increment('students_count');
        }

        return response()->json([
            'message' => 'Student enrolled successfully.',
            'enrollment' => $enrollment,
        ], 201);
    }

    /**
     * Adjust student wallet: deposit / withdraw / refund.
     *
     * - deposit  → add money (e.g. admin top-up)
     * - withdraw → deduct money (e.g. correction)
     * - refund   → return money after cancelling a purchase
     */
    public function updateWallet(Request $request, $studentId)
    {
        $request->validate([
            'type' => 'required|in:deposit,withdraw,refund',
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:500',
        ]);

        $student = User::where('type', 'student')->findOrFail($studentId);
        $walletService = app(WalletService::class);
        $noteText = $request->note ?? 'Admin adjustment';
        $meta = ['admin_id' => auth()->id(), 'note' => $request->note];

        if ($request->type === 'deposit') {
            $walletService->deposit($student->id, (float) $request->amount, "إيداع: {$noteText}", $meta);
        } elseif ($request->type === 'refund') {
            $walletService->refund($student->id, (float) $request->amount, "استرداد: {$noteText}", $meta);
        } else {
            try {
                $walletService->withdraw($student->id, (float) $request->amount, "خصم: {$noteText}", $meta);
            } catch (\InvalidArgumentException) {
                return response()->json(['message' => 'Insufficient balance.'], 400);
            }
        }

        return response()->json([
            'message' => 'Wallet updated successfully.',
            'wallet' => Wallet::where('user_id', $student->id)->first(),
        ]);
    }

    /**
     * Ban / Unban student.
     */
    public function toggleBan($studentId)
    {
        $student = User::where('type', 'student')->findOrFail($studentId);
        $student->update(['active' => ! $student->active]);

        return response()->json([
            'message' => $student->active ? 'Student activated.' : 'Student banned.',
            'active' => $student->active,
        ]);
    }

    /**
     * Delete student.
     */
    public function destroy($studentId)
    {
        $student = User::where('type', 'student')->findOrFail($studentId);
        $student->delete();

        return response()->json(['message' => 'Student deleted successfully.']);
    }
}
