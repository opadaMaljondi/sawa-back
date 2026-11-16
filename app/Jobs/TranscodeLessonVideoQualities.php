<?php

namespace App\Jobs;

use App\Models\Lesson;
use App\Support\VideoCloudDisk;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Optional multi-quality variants (360p / 720p / 1080p) via ffmpeg after source upload.
 */
class TranscodeLessonVideoQualities implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;

    public function __construct(public int $lessonId) {}

    public function handle(): void
    {
        if (! config('video.transcode_enabled')) {
            return;
        }

        $lesson = Lesson::find($this->lessonId);
        if (! $lesson || empty($lesson->video_reference)) {
            return;
        }

        if (! in_array($lesson->video_provider, ['local', 'aws', 'r2'], true)) {
            return;
        }

        $ffmpeg = (string) config('video.ffmpeg_binary', 'ffmpeg');
        $qualities = config('video.transcode_qualities', ['360', '720', '1080']);
        if (! is_array($qualities) || $qualities === []) {
            return;
        }

        $localSource = $this->materializeSourceLocally($lesson);
        if ($localSource === null) {
            Log::warning('TranscodeLessonVideoQualities: source missing', ['lesson_id' => $this->lessonId]);

            return;
        }

        $variants = is_array($lesson->video_variants) ? $lesson->video_variants : [];
        $baseDir = dirname($lesson->video_reference);
        $baseName = pathinfo($lesson->video_reference, PATHINFO_FILENAME);

        try {
            foreach ($qualities as $q) {
                $height = (int) $q;
                if ($height < 144) {
                    continue;
                }
                $label = $height.'p';
                $outName = $baseName.'_'.$label.'.mp4';
                $localOut = storage_path('app/videos/temp/'.Str::uuid().'_'.$outName);

                $cmd = sprintf(
                    '%s -y -i %s -vf scale=-2:%d -c:v libx264 -preset veryfast -crf 23 -c:a aac -movflags +faststart %s 2>&1',
                    escapeshellcmd($ffmpeg),
                    escapeshellarg($localSource),
                    $height,
                    escapeshellarg($localOut)
                );
                $output = [];
                $code = 0;
                exec($cmd, $output, $code);
                if ($code !== 0 || ! is_file($localOut)) {
                    Log::error('TranscodeLessonVideoQualities: ffmpeg failed', [
                        'lesson_id' => $this->lessonId,
                        'quality' => $label,
                        'code' => $code,
                        'output' => implode("\n", array_slice($output, -20)),
                    ]);
                    continue;
                }

                $objectPath = ($baseDir !== '.' ? $baseDir.'/' : '').$outName;
                $this->storeVariant($lesson, $objectPath, $localOut);
                @unlink($localOut);
                $variants[$label] = $objectPath;
            }

            $lesson->update(['video_variants' => $variants !== [] ? $variants : null]);
        } finally {
            if (str_contains($localSource, DIRECTORY_SEPARATOR.'videos'.DIRECTORY_SEPARATOR.'temp'.DIRECTORY_SEPARATOR)) {
                @unlink($localSource);
            }
        }
    }

    private function materializeSourceLocally(Lesson $lesson): ?string
    {
        if ($lesson->video_provider === 'local') {
            if (Storage::disk('public')->exists($lesson->video_reference)) {
                return Storage::disk('public')->path($lesson->video_reference);
            }
            if (Storage::disk('local')->exists($lesson->video_reference)) {
                return Storage::disk('local')->path($lesson->video_reference);
            }

            return null;
        }

        if (! VideoCloudDisk::isCloudProvider($lesson->video_provider)) {
            return null;
        }

        $disk = VideoCloudDisk::diskName($lesson->video_provider);
        $tmp = storage_path('app/videos/temp/'.Str::uuid().'_src.mp4');
        $dir = dirname($tmp);
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        try {
            $stream = Storage::disk($disk)->readStream($lesson->video_reference);
            if (! $stream) {
                return null;
            }
            $out = fopen($tmp, 'wb');
            if (! $out) {
                fclose($stream);

                return null;
            }
            stream_copy_to_stream($stream, $out);
            fclose($stream);
            fclose($out);
        } catch (\Throwable $e) {
            @unlink($tmp);
            Log::error('TranscodeLessonVideoQualities: pull source failed', [
                'lesson_id' => $this->lessonId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        return is_readable($tmp) ? $tmp : null;
    }

    private function storeVariant(Lesson $lesson, string $objectPath, string $localFile): void
    {
        if ($lesson->video_provider === 'local') {
            Storage::disk('public')->put($objectPath, fopen($localFile, 'rb'));

            return;
        }

        $disk = VideoCloudDisk::diskName($lesson->video_provider);
        $stream = fopen($localFile, 'rb');
        Storage::disk($disk)->put($objectPath, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }
    }
}
