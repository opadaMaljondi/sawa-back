<?php

namespace App\Models;

use App\Services\YouTubeService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

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
        'can_purchase_alone',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_free' => 'boolean',
        'can_download' => 'boolean',
        'can_purchase_alone' => 'boolean',
        'active' => 'boolean',
        'duration' => 'integer',
    ];

    protected $appends = ['video_playback_url', 'video_embed_url', 'thumbnail_url'];

    /** الدروس الظاهرة للطالب (موافق عليها من الأدمن). */
    public function scopeApprovedForStudents($query)
    {
        return $query->where('approval_status', 'approved')->where('active', true);
    }

    public function isApprovedForStudents(): bool
    {
        return $this->approval_status === 'approved' && $this->active;
    }

    /**
     * الرابط الكامل للتشغيل: لليوتيوب الرابط الكامل، للمحلي null.
     */
    public function getVideoPlaybackUrlAttribute(): ?string
    {
        if (empty($this->video_reference)) {
            return null;
        }

        if ($this->video_provider === 'local') {
            return Storage::disk('public')->exists($this->video_reference) 
                ? Storage::disk('public')->url($this->video_reference)
                : (Storage::disk('local')->exists($this->video_reference) 
                    ? asset('storage/' . $this->video_reference) // Assuming linked
                    : null);
        }

        if ($this->video_provider === 'aws') {
            return $this->video_reference
                ? Storage::disk('s3')->url($this->video_reference)
                : null;
        }

        if ($this->video_provider === 'youtube') {
            return YouTubeService::playbackUrl($this->video_reference);
        }

        return null;
    }

    public function getVideoEmbedUrlAttribute(): ?string
    {
        if (empty($this->video_reference)) {
            return null;
        }

        if ($this->video_provider === 'local' || $this->video_provider === 'aws') {
            return $this->video_playback_url; // Direct file URL works for video tag
        }

        if ($this->video_provider === 'youtube') {
            return YouTubeService::embedUrl($this->video_reference);
        }

        return null;
    }

    public function getThumbnailAttribute($value): ?string
    {
        if (!$value) return null;
        if (filter_var($value, FILTER_VALIDATE_URL)) return $value;
        return Storage::disk('public')->url($value);
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        return $this->thumbnail;
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

