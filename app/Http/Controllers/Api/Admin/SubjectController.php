<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SubjectController extends Controller
{
    /**
     * List subjects (filter by department, year, semester)
     */
    public function index(Request $request)
    {
        $query = Subject::with(['department', 'year', 'semester']);

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }
        if ($request->has('year_id')) {
            $query->where('year_id', $request->year_id);
        }
        if ($request->has('semester_id')) {
            $query->where('semester_id', $request->semester_id);
        }
        if ($request->has('active')) {
            $query->where('active', $request->boolean('active'));
        }
        if ($request->has('keyword')) {
            $query->where('name', 'like', '%' . $request->keyword . '%');
        }

        $subjects = $query->orderBy('name')->paginate($request->get('per_page', 20));

        return response()->json($subjects);
    }

    /**
     * Show subject
     */
    public function show($id)
    {
        $subject = Subject::with(['department', 'year', 'semester', 'courses'])->findOrFail($id);
        return response()->json($subject);
    }

    /**
     * Create subject
     */
    public function store(Request $request)
    {
        $request->validate([
            'department_id' => 'required|exists:departments,id',
            'year_id' => 'required|exists:years,id',
            'semester_id' => 'required|exists:semesters,id',
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subjects,slug',
            'description' => 'nullable|string',
            'active' => 'boolean',
        ]);

        $slug = $request->slug ?? Str::slug($request->name);
        if (Subject::where('slug', $slug)->exists()) {
            $slug = $slug . '-' . uniqid();
        }

        $subject = Subject::create([
            'department_id' => $request->department_id,
            'year_id' => $request->year_id,
            'semester_id' => $request->semester_id,
            'name' => $request->name,
            'slug' => $slug,
            'description' => $request->description,
            'active' => $request->boolean('active', true),
        ]);

        return response()->json([
            'message' => 'Subject created successfully',
            'subject' => $subject,
        ], 201);
    }

    /**
     * Update subject
     */
    public function update(Request $request, $id)
    {
        $subject = Subject::findOrFail($id);

        $request->validate([
            'department_id' => 'sometimes|exists:departments,id',
            'year_id' => 'sometimes|exists:years,id',
            'semester_id' => 'sometimes|exists:semesters,id',
            'name' => 'sometimes|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subjects,slug,' . $id,
            'description' => 'nullable|string',
            'active' => 'boolean',
        ]);

        $subject->update($request->only([
            'department_id', 'year_id', 'semester_id', 'name', 'slug', 'description', 'active',
        ]));

        return response()->json([
            'message' => 'Subject updated successfully',
            'subject' => $subject->fresh(),
        ]);
    }

    /**
     * Delete subject
     */
    public function destroy($id)
    {
        $subject = Subject::findOrFail($id);
        $subject->delete();
        return response()->json(['message' => 'Subject deleted successfully']);
    }
}
