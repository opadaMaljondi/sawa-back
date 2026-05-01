<?php

namespace Database\Seeders;

use App\Models\Semester;
use App\Models\Year;
use Illuminate\Database\Seeder;

class YearSemestersSeeder extends Seeder
{
    /** الفصل الأول والثاني بالعربي (order => name) */
    private const SEMESTER_NAMES = [
        1 => 'الفصل الأول',
        2 => 'الفصل الثاني',
    ];

    public function run(): void
    {
        foreach (Year::query()->orderBy('department_id')->orderBy('order')->cursor() as $year) {
            foreach (self::SEMESTER_NAMES as $order => $name) {
                Semester::firstOrCreate(
                    [
                        'year_id' => $year->id,
                        'order' => $order,
                    ],
                    [
                        'name' => $name,
                        'active' => true,
                    ]
                );
            }
        }
    }
}
