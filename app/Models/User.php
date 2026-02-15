<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'password',
        'image',
        'type',
        'referral_code',
        'active',
        'email_verified_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'active' => 'boolean',
    ];

    public function wallet()
    {
        return $this->hasOne(Wallet::class);
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
     * Check if the user (student) has access to a course (has any active enrollment).
     */
    public function hasAccessToCourse(int $courseId): bool
    {
        if ($this->type === 'admin') {
            return true;
        }
        if ($this->type !== 'student') {
            return false;
        }
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

        $courseId = $lesson->course_id ?? $lesson->section?->course_id;
        if (!$courseId) {
            return false;
        }

        $sectionId = $lesson->section_id ?? $lesson->section?->id;

        $query = Enrollment::where('student_id', $this->id)
            ->where('active', true)
            ->where('course_id', $courseId)
            ->where(function ($q) use ($lesson, $sectionId) {
                $q->where('type', 'full_course')
                    ->orWhere('type', 'lesson')->where('lesson_id', $lesson->id);
                if ($sectionId) {
                    $q->orWhere(function ($q2) use ($sectionId) {
                        $q2->where('type', 'section')->where('section_id', $sectionId);
                    });
                }
            });

        return $query->exists();
    }
}
