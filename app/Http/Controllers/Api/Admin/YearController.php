<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Year;
use Illuminate\Http\Request;

class YearController extends Controller
{
    /**
     * List years (optionally by department)
     */
    public function index(Request $request)
    {
        $query = Year::with(['department']);

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }
        if ($request->has('active')) {
            $query->where('active', $request->boolean('active'));
        }

        $years = $query->orderBy('order')->orderBy('name')->paginate($request->get('per_page', 20));

        return response()->json($years);
    }

    /**
     * Show year
     */
    public function show($id)
    {
        $year = Year::with(['department', 'semesters', 'subjects'])->findOrFail($id);
        return response()->json($year);
    }

    /**
     * Create year
     */
    public function store(Request $request)
    {
        $request->validate([
            'department_id' => 'required|exists:departments,id',
            'name' => 'required|string|max:255',
            'order' => 'nullable|integer|min:0',
            'active' => 'boolean',
        ]);

        $year = Year::create([
            'department_id' => $request->department_id,
            'name' => $request->name,
            'order' => $request->order ?? 1,
            'active' => $request->boolean('active', true),
        ]);

        return response()->json([
            'message' => 'Year created successfully',
            'year' => $year,
        ], 201);
    }

    /**
     * Update year
     */
    public function update(Request $request, $id)
    {
        $year = Year::findOrFail($id);

        $request->validate([
            'department_id' => 'sometimes|exists:departments,id',
            'name' => 'sometimes|string|max:255',
            'order' => 'nullable|integer|min:0',
            'active' => 'boolean',
        ]);

        $year->update($request->only(['department_id', 'name', 'order', 'active']));

        return response()->json([
            'message' => 'Year updated successfully',
            'year' => $year->fresh(),
        ]);
    }

    /**
     * Delete year
     */
    public function destroy($id)
    {
        $year = Year::findOrFail($id);
        $year->delete();
        return response()->json(['message' => 'Year deleted successfully']);
    }
}
