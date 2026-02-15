<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Note extends Model
{
    protected $fillable = [
        'course_id',
        'lesson_id',
        'title',
        'description',
        'file_path',
        'file_name',
        'file_type',
        'file_size',
        'price',
        'is_free',
        'department_id',
        'subject_id',
        'prevent_download',
        'active',
        'uploaded_by',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'price' => 'decimal:2',
        'is_free' => 'boolean',
        'prevent_download' => 'boolean',
        'active' => 'boolean',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
