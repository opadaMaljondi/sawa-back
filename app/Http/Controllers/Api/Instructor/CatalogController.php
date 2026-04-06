<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Api\Student\CourseController as StudentCourseController;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * Browse academic structure & published courses (delegates to student catalog logic).
 */
class CatalogController extends Controller
{
    public function departmentShow($id)
    {
        return app(StudentCourseController::class)->departmentShow($id);
    }

    public function coursesByYearAndSemester(Request $request, $departmentId)
    {
        return app(StudentCourseController::class)->coursesByYearAndSemester($request, $departmentId);
    }

    public function coursesBySubject($subjectId)
    {
        return app(StudentCourseController::class)->getCoursesBySubject($subjectId);
    }

    public function searchCourses(Request $request)
    {
        return app(StudentCourseController::class)->search($request);
    }
}
