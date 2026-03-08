<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'password',
        'image',
        'specialty',
        'bio',
        'type',
        'google_id',
        'department_id',
        'year_id',
        'referral_code',
        'active',
        'email_verified_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'active' => 'boolean',
    ];

    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image) return null;
        if (filter_var($this->image, FILTER_VALIDATE_URL)) return $this->image;
        return Storage::disk('public')->url($this->image);
    }

    public function wallet()
    {
        return $this->hasOne(Wallet::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function year()
    {
        return $this->belongsTo(Year::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class, 'student_id');
    }

    /** الكورسات التي يدرّسها المستخدم (عندما يكون معلماً). */
    public function courses()
    {
        return $this->hasMany(Course::class, 'instructor_id');
    }

    /** إشعارات التطبيق (جدول notifications). */
    public function appNotifications()
    {
        return $this->hasMany(UserNotification::class, 'user_id');
    }

    /**
     * Check if the user (student) has a full-course enrollment for a given course.
     */
    public function hasFullCourseAccess(int $courseId): bool
    {
        if ($this->type === 'admin') return true;
        if ($this->type !== 'student') return false;

        return Enrollment::where('student_id', $this->id)
            ->where('course_id', $courseId)
            ->where('type', 'full_course')
            ->where('active', true)
            ->exists();
    }

    /**
     * Check if the user (student) has access to a course (any enrollment type).
     */
    public function hasAccessToCourse(int $courseId): bool
    {
        if ($this->type === 'admin') return true;
        if ($this->type !== 'student') return false;

        return Enrollment::where('student_id', $this->id)
            ->where('active', true)
            ->where('course_id', $courseId)
            ->exists();
    }

    /**
     * Check if the user (student) has access to a lesson (enrolled in course/section/lesson).
     */
    public function hasAccessToLesson(int $lessonId): bool
    {
        if ($this->type !== 'student') {
            return false;
        }

        $lesson = Lesson::with('section')->find($lessonId);
        if (!$lesson) {
            return false;
        }

        $courseId  = $lesson->course_id ?? $lesson->section?->course_id;
        if (!$courseId) {
            return false;
        }

        $sectionId = $lesson->section_id ?? $lesson->section?->id;

        return Enrollment::where('student_id', $this->id)
            ->where('active', true)
            ->where('course_id', $courseId)
            ->where(function ($q) use ($lesson, $sectionId) {
                $q->where('type', 'full_course')
                  ->orWhere(fn ($q2) => $q2->where('type', 'lesson')->where('lesson_id', $lesson->id));
                if ($sectionId) {
                    $q->orWhere(fn ($q2) => $q2->where('type', 'section')->where('section_id', $sectionId));
                }
            })
            ->exists();
    }

    /**
     * Check if the user (student) has access to a note/file.
     */
    public function hasAccessToNote(int $noteId, int $courseId): bool
    {
        if ($this->type === 'admin') return true;
        if ($this->type !== 'student') return false;

        // Full-course enrollment → access to all course notes
        if ($this->hasFullCourseAccess($courseId)) return true;

        // Individual note purchase
        return Enrollment::where('student_id', $this->id)
            ->where('type', 'attachment')
            ->where('note_id', $noteId)
            ->where('active', true)
            ->exists();
    }
}
