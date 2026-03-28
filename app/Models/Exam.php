<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Exam extends Model
{
    protected $fillable = [
        'course_id',
        'title',
        'description',
        'attachment',
        'active',
        'available_from',
        'available_until',
        'created_by',
    ];

    protected $casts = [
        'active' => 'boolean',
        'available_from' => 'datetime',
        'available_until' => 'datetime',
    ];

    protected $appends = ['attachment_url'];

    public function getAttachmentUrlAttribute(): ?string
    {
        if (! $this->attachment) {
            return null;
        }
        if (filter_var($this->attachment, FILTER_VALIDATE_URL)) {
            return $this->attachment;
        }

        return Storage::disk('public')->url($this->attachment);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
