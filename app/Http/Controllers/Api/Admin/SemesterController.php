<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Semester;
use Illuminate\Http\Request;

class SemesterController extends Controller
{
    /**
     * List semesters (optionally by year)
     */
    public function index(Request $request)
    {
        $query = Semester::with(['year']);

        if ($request->has('year_id')) {
            $query->where('year_id', $request->year_id);
        }
        if ($request->has('active')) {
            $query->where('active', $request->boolean('active'));
        }

        $semesters = $query->orderBy('order')->orderBy('name')->paginate($request->get('per_page', 20));

        return response()->json($semesters);
    }

    /**
     * Show semester
     */
    public function show($id)
    {
        $semester = Semester::with(['year.department', 'subjects'])->findOrFail($id);
        return response()->json($semester);
    }

    /**
     * Create semester
     */
    public function store(Request $request)
    {
        $request->validate([
            'year_id' => 'required|exists:years,id',
            'name' => 'required|string|max:255',
            'order' => 'nullable|integer|min:0',
            'active' => 'boolean',
        ]);

        $semester = Semester::create([
            'year_id' => $request->year_id,
            'name' => $request->name,
            'order' => $request->order ?? 1,
            'active' => $request->boolean('active', true),
        ]);

        return response()->json([
            'message' => 'Semester created successfully',
            'semester' => $semester,
        ], 201);
    }

    /**
     * Update semester
     */
    public function update(Request $request, $id)
    {
        $semester = Semester::findOrFail($id);

        $request->validate([
            'year_id' => 'sometimes|exists:years,id',
            'name' => 'sometimes|string|max:255',
            'order' => 'nullable|integer|min:0',
            'active' => 'boolean',
        ]);

        $semester->update($request->only(['year_id', 'name', 'order', 'active']));

        return response()->json([
            'message' => 'Semester updated successfully',
            'semester' => $semester->fresh(),
        ]);
    }

    /**
     * Delete semester
     */
    public function destroy($id)
    {
        $semester = Semester::findOrFail($id);
        $semester->delete();
        return response()->json(['message' => 'Semester deleted successfully']);
    }
}
