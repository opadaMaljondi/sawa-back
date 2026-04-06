<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    /**
     * List subjects for a department + year + semester (for picking subject when creating a course).
     *
     * GET /instructor/subjects?department_id=&year_id=&semester_id=
     * GET /instructor/departments/{departmentId}/subjects?year_id=&semester_id=  (department in path)
     */
    public function index(Request $request, ?int $departmentId = null)
    {
        if ($departmentId !== null) {
            $request->merge(['department_id' => $departmentId]);
        }

        $request->validate([
            'department_id' => 'required|exists:departments,id',
            'year_id' => 'required|exists:years,id',
            'semester_id' => 'required|exists:semesters,id',
        ]);

        $subjects = Subject::where('department_id', $request->department_id)
            ->where('year_id', $request->year_id)
            ->where('semester_id', $request->semester_id)
            ->where('active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['subjects' => $subjects]);
    }
}
