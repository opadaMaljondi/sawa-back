<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Course extends Model
{
    use HasFactory;

    protected $appends = ['image_url'];

    protected $fillable = [
        'subject_id',
        'instructor_id',
        'title',
        'description',
        'image',
        'price',
        'admin_commission',
        'allow_section_purchase',
        'allow_lesson_purchase',
        'free_first_lesson',
        'status',
        'active',
        'students_count',
        'rating',
        'reviews_count',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'admin_commission' => 'decimal:2',
        'allow_section_purchase' => 'boolean',
        'allow_lesson_purchase' => 'boolean',
        'free_first_lesson' => 'boolean',
        'active' => 'boolean',
        'students_count' => 'integer',
        'rating' => 'decimal:2',
        'reviews_count' => 'integer',
    ];

    public function getImageAttribute($value): ?string
    {
        if (! $value) {
            return null;
        }
        if (filter_var($value, FILTER_VALIDATE_URL)) {
            return $value;
        }

        return Storage::disk('public')->url($value);
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image;
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function instructor()
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    /** الكورسات الظاهرة للطالب (موافق عليها من الأدمن). */
    public function scopeApprovedForStudents($query)
    {
        return $query->where('status', 'published')->where('active', true);
    }

    public function sections()
    {
        return $this->hasMany(CourseSection::class);
    }

    public function lessons()
    {
        return $this->hasMany(Lesson::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function notes()
    {
        return $this->hasMany(Note::class);
    }

    public function exams()
    {
        return $this->hasMany(Exam::class);
    }
}
