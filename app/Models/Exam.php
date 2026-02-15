<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Exam extends Model
{
    protected $fillable = [
        'course_id',
        'title',
        'description',
        'attachment',
        'active',
        'duration',
        'available_from',
        'available_until',
        'created_by',
    ];

    protected $casts = [
        'active' => 'boolean',
        'available_from' => 'datetime',
        'available_until' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function questions()
    {
        return $this->hasMany(ExamQuestion::class, 'exam_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
