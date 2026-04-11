<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use App\Support\FullCourseContentNotifier;
use Illuminate\Http\Request;

class CourseSectionController extends Controller
{
    protected function authorizeCourse(int $courseId): Course
    {
        return Course::where('instructor_id', auth()->id())->findOrFail($courseId);
    }

    public function index(Request $request, $courseId)
    {
        $this->authorizeCourse($courseId);

        $sections = CourseSection::where('course_id', $courseId)
            ->withCount('lessons')
            ->orderBy('order')
            ->get();

        return response()->json(['sections' => $sections]);
    }

    public function store(Request $request, $courseId)
    {
        $course = $this->authorizeCourse($courseId);

        if (! auth()->user()->hasPermissionTo('edit course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'order'       => 'nullable|integer|min:0',
            'price'       => 'nullable|numeric|min:0',
        ]);

        $section = CourseSection::create([
            'course_id'   => $course->id,
            'title'       => $request->title,
            'description' => $request->description,
            'order'       => $request->input('order', 1),
            'price'       => $request->input('price'),
        ]);

        FullCourseContentNotifier::sectionCreated($section);

        return response()->json([
            'message' => 'Section created',
            'section' => $section,
        ], 201);
    }

    public function update(Request $request, $courseId, $sectionId)
    {
        $this->authorizeCourse($courseId);

        if (! auth()->user()->hasPermissionTo('edit course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $section = CourseSection::where('course_id', $courseId)->findOrFail($sectionId);

        $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'order'       => 'nullable|integer|min:0',
            'price'       => 'nullable|numeric|min:0',
        ]);

        $section->update($request->only(['title', 'description', 'order', 'price']));

        return response()->json([
            'message' => 'Section updated',
            'section' => $section->fresh(),
        ]);
    }

    public function destroy($courseId, $sectionId)
    {
        $this->authorizeCourse($courseId);

        if (! auth()->user()->hasPermissionTo('edit course')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $section = CourseSection::where('course_id', $courseId)->findOrFail($sectionId);
        $section->delete();

        return response()->json(['message' => 'Section deleted']);
    }
}
