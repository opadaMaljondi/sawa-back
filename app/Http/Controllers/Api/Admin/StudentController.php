<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Enrollment;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    /**
     * Get all students
     */
    public function index(Request $request)
    {
        $query = User::where('type', 'student')
            ->with(['wallet']);

        // فلترة حسب القسم
        if ($request->has('department_id')) {
            $query->whereHas('enrollments.course.subject', function ($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }

        // فلترة حسب السنة
        if ($request->has('year_id')) {
            $query->whereHas('enrollments.course.subject', function ($q) use ($request) {
                $q->where('year_id', $request->year_id);
            });
        }

        $students = $query->paginate(20);

        return response()->json($students);
    }

    /**
     * Get student details
     */
    public function show($studentId)
    {
        $student = User::where('type', 'student')
            ->with([
                'wallet',
                'enrollments.course',
                'enrollments.section',
                'enrollments.lesson',
            ])
            ->findOrFail($studentId);

        return response()->json($student);
    }

    /**
     * Enroll student in course
     */
    public function enrollStudent(Request $request, $studentId)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'type' => 'required|in:full_course,section,lesson',
            'section_id' => 'nullable|exists:course_sections,id',
            'lesson_id' => 'nullable|exists:lessons,id',
            'free' => 'boolean',
        ]);

        $student = User::where('type', 'student')->findOrFail($studentId);
        $course = \App\Models\Course::findOrFail($request->course_id);

        $enrollment = Enrollment::create([
            'student_id' => $student->id,
            'course_id' => $course->id,
            'type' => $request->type,
            'section_id' => $request->section_id ?? null,
            'lesson_id' => $request->lesson_id ?? null,
            'original_price' => $request->free ? 0 : $course->price,
            'discount' => $request->free ? $course->price : 0,
            'final_price' => $request->free ? 0 : $course->price,
            'active' => true,
            'enrolled_at' => now(),
        ]);

        return response()->json([
            'message' => 'Student enrolled successfully',
            'enrollment' => $enrollment,
        ], 201);
    }

    /**
     * Update student wallet
     */
    public function updateWallet(Request $request, $studentId)
    {
        $request->validate([
            'amount' => 'required|numeric',
            'type' => 'required|in:deposit,withdraw',
        ]);

        $student = User::where('type', 'student')->findOrFail($studentId);
        $walletService = app(\App\Services\WalletService::class);

        if ($request->type === 'deposit') {
            $walletService->deposit(
                $student->id,
                $request->amount,
                'Admin deposit',
                ['admin_id' => auth()->id()]
            );
        } else {
            $walletService->withdraw(
                $student->id,
                $request->amount,
                'Admin withdrawal',
                ['admin_id' => auth()->id()]
            );
        }

        return response()->json(['message' => 'Wallet updated successfully']);
    }

    /**
     * Ban/Unban student
     */
    public function toggleBan($studentId)
    {
        $student = User::where('type', 'student')->findOrFail($studentId);
        $student->update(['active' => !$student->active]);

        return response()->json([
            'message' => $student->active ? 'Student activated' : 'Student banned',
            'student' => $student,
        ]);
    }
}
