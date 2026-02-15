<?php

namespace App\Models;

use App\Services\YouTubeService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lesson extends Model
{
    use HasFactory;

    protected $fillable = [
        'course_id',
        'section_id',
        'title',
        'description',
        'order',
        'duration',
        'youtube_id',
        'youtube_url',
        'thumbnail',
        'video_provider',
        'video_reference',
        'price',
        'is_free',
        'can_download',
        'upload_status',
        'approval_status',
        'active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_free' => 'boolean',
        'can_download' => 'boolean',
        'active' => 'boolean',
        'duration' => 'integer',
    ];

    protected $appends = ['video_playback_url'];

    /** الدروس الظاهرة للطالب (موافق عليها من الأدمن). */
    public function scopeApprovedForStudents($query)
    {
        return $query->where('approval_status', 'approved')->where('active', true);
    }

    /**
     * الرابط الكامل للتشغيل: لليوتيوب الرابط الكامل، للمحلي null.
     */
    public function getVideoPlaybackUrlAttribute(): ?string
    {
        if ($this->video_provider !== 'youtube' || empty($this->video_reference)) {
            return null;
        }
        $ref = $this->video_reference;
        if (str_contains($ref, 'youtube.com') || str_contains($ref, 'youtu.be')) {
            return $ref;
        }
        return YouTubeService::playbackUrl($ref);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function section()
    {
        return $this->belongsTo(CourseSection::class, 'section_id');
    }
}

