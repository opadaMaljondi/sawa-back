<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use Illuminate\Http\Request;

class CourseSectionController extends Controller
{
    /**
     * List sections (optionally by course)
     */
    public function index(Request $request)
    {
        $query = CourseSection::with(['course']);

        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        $sections = $query->orderBy('order')->orderBy('title')->paginate($request->get('per_page', 20));

        return response()->json($sections);
    }

    /**
     * Show section
     */
    public function show($id)
    {
        $section = CourseSection::with(['course', 'lessons'])->findOrFail($id);
        return response()->json($section);
    }

    /**
     * Create section
     */
    public function store(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer|min:0',
            'price' => 'nullable|numeric|min:0',
        ]);

        $course = Course::findOrFail($request->course_id);

        $section = CourseSection::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'description' => $request->description,
            'order' => $request->order ?? 1,
            'price' => $request->price,
        ]);

        return response()->json([
            'message' => 'Course section created successfully',
            'section' => $section,
        ], 201);
    }

    /**
     * Update section
     */
    public function update(Request $request, $id)
    {
        $section = CourseSection::findOrFail($id);

        $request->validate([
            'course_id' => 'sometimes|exists:courses,id',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'order' => 'nullable|integer|min:0',
            'price' => 'nullable|numeric|min:0',
        ]);

        $section->update($request->only([
            'course_id', 'title', 'description', 'order', 'price',
        ]));

        return response()->json([
            'message' => 'Course section updated successfully',
            'section' => $section->fresh(),
        ]);
    }

    /**
     * Delete section
     */
    public function destroy($id)
    {
        $section = CourseSection::findOrFail($id);
        $section->delete();
        return response()->json(['message' => 'Course section deleted successfully']);
    }
}
