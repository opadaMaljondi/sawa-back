<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Enrollment extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'course_id',
        'type',
        'section_id',
        'lesson_id',
        'original_price',
        'discount',
        'final_price',
        'coupon_code',
        'progress',
        'completed',
        'completed_at',
        'active',
        'enrolled_at',
    ];

    protected $casts = [
        'original_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'final_price' => 'decimal:2',
        'progress' => 'integer',
        'completed' => 'boolean',
        'active' => 'boolean',
        'completed_at' => 'datetime',
        'enrolled_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function section()
    {
        return $this->belongsTo(CourseSection::class, 'section_id');
    }

    public function lesson()
    {
        return $this->belongsTo(Lesson::class, 'lesson_id');
    }
}
