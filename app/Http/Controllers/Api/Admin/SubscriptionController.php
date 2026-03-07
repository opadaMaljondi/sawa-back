<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    /**
     * List all enrollments with filters.
     *
     * Filters: search, course_id, student_id, type, active, from, to
     */
    public function index(Request $request)
    {
        $query = Enrollment::with([
            'student:id,full_name,email,phone',
            'course:id,title,price',
            'section:id,title',
            'lesson:id,title',
            'note:id,title',
        ])->latest('enrolled_at');

        if ($request->filled('search')) {
            $s = $request->search;
            $query->whereHas('student', fn ($q) => $q
                ->where('full_name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
            );
        }

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        if ($request->filled('from')) {
            $query->whereDate('enrolled_at', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->whereDate('enrolled_at', '<=', $request->to);
        }

        return response()->json($query->paginate($request->integer('limit', 20)));
    }

    /**
     * Show single enrollment details.
     */
    public function show($id)
    {
        $enrollment = Enrollment::with([
            'student:id,full_name,email,phone',
            'course:id,title,price,image',
            'section:id,title,price',
            'lesson:id,title,price',
            'note:id,title,price',
        ])->findOrFail($id);

        return response()->json($enrollment);
    }

    /**
     * Toggle enrollment active status (suspend / activate).
     */
    public function toggleStatus($id)
    {
        $enrollment         = Enrollment::findOrFail($id);
        $enrollment->active = !$enrollment->active;
        $enrollment->save();

        return response()->json([
            'message' => $enrollment->active ? 'Enrollment activated.' : 'Enrollment suspended.',
            'active'  => $enrollment->active,
        ]);
    }

    /**
     * Refund enrollment: deactivate it and return the paid amount to student wallet.
     *
     * POST /admin/subscriptions/{id}/refund
     * Body (optional): { "amount": 5000, "note": "Customer request" }
     *   - If amount is omitted, the full final_price is refunded.
     */
    public function refund(Request $request, $id)
    {
        $request->validate([
            'amount' => 'nullable|numeric|min:0.01',
            'note'   => 'nullable|string|max:500',
        ]);

        $enrollment = Enrollment::with('student')->findOrFail($id);

        if (!$enrollment->active) {
            return response()->json(['message' => 'Enrollment is already inactive/cancelled.'], 422);
        }

        $refundAmount = $request->filled('amount')
            ? (float) $request->amount
            : (float) $enrollment->final_price;

        if ($refundAmount <= 0) {
            return response()->json(['message' => 'Nothing to refund (final price is 0).'], 422);
        }

        DB::transaction(function () use ($enrollment, $refundAmount, $request) {
            // Deactivate enrollment
            $enrollment->update(['active' => false]);

            // Decrement students_count for full-course refunds
            if ($enrollment->type === 'full_course') {
                Course::where('id', $enrollment->course_id)->decrement('students_count');
            }

            // Refund to wallet
            $walletService = app(\App\Services\WalletService::class);
            $noteText      = $request->note ?? 'Enrollment refund';
            $walletService->refund(
                $enrollment->student_id,
                $refundAmount,
                "استرداد: {$noteText}",
                [
                    'admin_id'      => auth()->id(),
                    'enrollment_id' => $enrollment->id,
                    'course_id'     => $enrollment->course_id,
                    'note'          => $request->note,
                ]
            );
        });

        return response()->json([
            'message'       => 'Enrollment cancelled and amount refunded to wallet.',
            'refund_amount' => $refundAmount,
            'enrollment_id' => $enrollment->id,
        ]);
    }
}
