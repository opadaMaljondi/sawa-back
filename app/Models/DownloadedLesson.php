<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DownloadedLesson extends Model
{
    use HasFactory;

    protected $table = 'downloaded_lessons';

    protected $fillable = [
        'lesson_id',
        'student_id',
        'device_id',
        'token',
        'encryption_key',
        'encrypted_path',
        'quality',
        'file_size',
        'expires_at',
        'max_views',
        'view_count',
        'status',
        'downloaded_at',
        'last_accessed_at',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'view_count' => 'integer',
        'max_views' => 'integer',
        'expires_at' => 'datetime',
        'downloaded_at' => 'datetime',
        'last_accessed_at' => 'datetime',
    ];

    public function lesson()
    {
        return $this->belongsTo(Lesson::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function device()
    {
        return $this->belongsTo(Device::class);
    }
}
