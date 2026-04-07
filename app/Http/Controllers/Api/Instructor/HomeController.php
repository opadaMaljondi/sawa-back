<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\Department;

/**
 * Instructor app home: banners + departments (browse catalog structure).
 */
class HomeController extends Controller
{
    public function index()
    {
        $banners = Banner::where('active', true)->orderBy('order')->get();

        $departments = Department::where('active', true)
            ->select('id', 'name', 'name_en', 'icon', 'color', 'order')
            ->orderBy('order')
            ->get();

        return response()->json([
            'banners'     => $banners,
            'departments' => $departments,
        ]);
    }
}
