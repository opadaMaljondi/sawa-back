<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    /**
     * Display a listing of all student enrollments (subscriptions).
     */
    public function index(Request $request)
    {
        $query = Enrollment::with(['student', 'course', 'section', 'lesson'])
            ->latest();

        // Search logic
        if ($request->has('search')) {
            $search = $request->get('search');
            $query->whereHas('student', function($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $enrollments = $query->paginate($request->get('limit', 15));

        return response()->json($enrollments);
    }

    /**
     * Toggle the active status of an enrollment.
     */
    public function toggleStatus($id)
    {
        $enrollment = Enrollment::findOrFail($id);
        $enrollment->active = !$enrollment->active;
        $enrollment->save();

        return response()->json([
            'message' => 'Enrollment status updated successfully',
            'active' => $enrollment->active
        ]);
    }
}
