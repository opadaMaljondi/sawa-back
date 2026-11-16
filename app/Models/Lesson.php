<?php

namespace App\Models;

use App\Services\YouTubeService;
use App\Support\VideoCloudDisk;
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
        'video_variants',
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
        'video_variants' => 'array',
    ];

    protected $appends = ['video_playback_url', 'video_embed_url', 'thumbnail_url', 'video_quality_urls'];

    /** @var array{0: bool, 1: ?string} */
    private array $playbackUrlMemo = [false, null];

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
        if ($this->playbackUrlMemo[0]) {
            return $this->playbackUrlMemo[1];
        }

        $url = $this->resolveVideoPlaybackUrl();
        $this->playbackUrlMemo = [true, $url];

        return $url;
    }

    private function resolveVideoPlaybackUrl(): ?string
    {
        if (empty($this->video_reference)) {
            return null;
        }

        if ($this->video_provider === 'local') {
            // Avoid disk exists() on every JSON serialize (course lists).
            return Storage::disk('public')->url($this->video_reference);
        }

        if (VideoCloudDisk::isCloudProvider($this->video_provider)) {
            return $this->cloudObjectUrl($this->video_reference);
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

        if ($this->video_provider === 'local' || VideoCloudDisk::isCloudProvider($this->video_provider)) {
            return $this->video_playback_url;
        }

        if ($this->video_provider === 'youtube') {
            return YouTubeService::embedUrl($this->video_reference);
        }

        return null;
    }

    /**
     * روابط الجودات بعد الترانسكود (360p/720p/1080p) إن وُجدت.
     *
     * @return array<string, string>
     */
    public function getVideoQualityUrlsAttribute(): array
    {
        $variants = is_array($this->video_variants) ? $this->video_variants : [];
        if ($variants === []) {
            return [];
        }

        $out = [];
        foreach ($variants as $label => $path) {
            if (! is_string($path) || $path === '') {
                continue;
            }
            $url = $this->urlForStoredVideoPath($path);
            if ($url) {
                $out[(string) $label] = $url;
            }
        }

        return $out;
    }

    public function urlForStoredVideoPath(string $path): ?string
    {
        if ($this->video_provider === 'local') {
            return Storage::disk('public')->url($path);
        }

        if (VideoCloudDisk::isCloudProvider($this->video_provider)) {
            return $this->cloudObjectUrl($path);
        }

        return null;
    }

    private function cloudObjectUrl(string $path): ?string
    {
        try {
            $disk = VideoCloudDisk::diskName($this->video_provider);
            $cfgUrl = (string) (config("filesystems.disks.{$disk}.url") ?? '');
            if ($cfgUrl !== '') {
                return Storage::disk($disk)->url($path);
            }

            return Storage::disk($disk)->temporaryUrl($path, now()->addHours(6));
        } catch (\Throwable) {
            try {
                return Storage::disk(VideoCloudDisk::diskName($this->video_provider))->url($path);
            } catch (\Throwable) {
                return null;
            }
        }
    }

    /**
     * رابط كامل للصورة المصغرة (لا يُعدّل عمود thumbnail في القاعدة).
     */
    public function getThumbnailUrlAttribute(): ?string
    {
        $value = $this->attributes['thumbnail'] ?? null;
        if ($value === null || $value === '') {
            return null;
        }
        if (filter_var($value, FILTER_VALIDATE_URL)) {
            return $value;
        }

        return Storage::disk('public')->url($value);
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

