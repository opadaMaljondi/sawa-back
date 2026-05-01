<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Year;
use Illuminate\Database\Seeder;

class DepartmentYearsSeeder extends Seeder
{
    /** أسماء السنوات الخمس بالعربي (order => name) */
    private const YEAR_NAMES = [
        1 => 'السنة الأولى',
        2 => 'السنة الثانية',
        3 => 'السنة الثالثة',
        4 => 'السنة الرابعة',
        5 => 'السنة الخامسة',
    ];

    public function run(): void
    {
        foreach (Department::query()->orderBy('order')->orderBy('id')->cursor() as $department) {
            foreach (self::YEAR_NAMES as $order => $name) {
                Year::firstOrCreate(
                    [
                        'department_id' => $department->id,
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
