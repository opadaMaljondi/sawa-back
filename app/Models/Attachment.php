<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Attachment extends Model
{
    use HasFactory;

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
        'prevent_download',
        'active',
        'uploaded_by',
    ];

    protected $casts = [
        'is_free' => 'boolean',
        'prevent_download' => 'boolean',
        'active' => 'boolean',
        'file_size' => 'integer',
        'price' => 'decimal:2',
    ];

    protected $appends = ['file_url'];

    public function getFileUrlAttribute(): ?string
    {
        if (!$this->file_path) return null;
        return Storage::disk('public')->url($this->file_path);
    }

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
