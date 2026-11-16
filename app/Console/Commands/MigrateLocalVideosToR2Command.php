<?php

namespace App\Console\Commands;

use App\Models\Lesson;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Background copy of locally stored lesson videos to Cloudflare R2.
 * Playback stays on local files until the R2 object is verified, then the lesson
 * is flipped to video_provider=r2. Local copies are kept unless --delete-local.
 */
class MigrateLocalVideosToR2Command extends Command
{
    protected $signature = 'videos:migrate-local-to-r2
                            {--limit=1 : Number of lessons to migrate per run}
                            {--lesson= : Migrate a single lesson id}
                            {--delete-local : Remove local files after a verified R2 switch}
                            {--dry-run : List candidates without uploading}';

    protected $description = 'Copy local lesson videos to Cloudflare R2 then switch video_provider without interrupting playback';

    public function handle(): int
    {
        if (! config('video.migrate_local_to_r2')) {
            $this->info('Migration disabled (VIDEO_MIGRATE_LOCAL_TO_R2=false).');

            return self::SUCCESS;
        }

        $cfg = config('filesystems.disks.r2', []);
        if (trim((string) ($cfg['key'] ?? '')) === '' || trim((string) ($cfg['secret'] ?? '')) === '' || trim((string) ($cfg['endpoint'] ?? '')) === '') {
            $this->error('R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT.');

            return self::FAILURE;
        }

        @set_time_limit(0);

        $limit = max(1, (int) $this->option('limit'));
        $query = Lesson::query()
            ->where('video_provider', 'local')
            ->whereNotNull('video_reference')
            ->where('video_reference', '!=', '')
            ->where(function ($q) {
                $q->whereNull('upload_status')->orWhere('upload_status', '!=', 'uploading');
            })
            ->orderBy('id');

        if ($this->option('lesson')) {
            $query->where('id', (int) $this->option('lesson'));
        }

        $remaining = (clone $query)->count();
        $lessons = $query->limit($limit)->get();

        if ($lessons->isEmpty()) {
            $this->info('No local videos left to migrate.');

            return self::SUCCESS;
        }

        $this->info("Remaining local lessons: {$remaining}. This run: {$lessons->count()}.");

        $ok = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($lessons as $lesson) {
            if ($this->option('dry-run')) {
                $this->line("dry-run lesson {$lesson->id} {$lesson->video_reference}");
                $ok++;

                continue;
            }

            $lock = Cache::lock('migrate_local_r2:lesson:'.$lesson->id, 7200);
            if (! $lock->get()) {
                $this->warn("lesson {$lesson->id} already migrating, skip.");
                $skipped++;

                continue;
            }

            try {
                $result = $this->migrateLesson($lesson);
                if ($result === 'ok') {
                    $ok++;
                    $this->info("lesson {$lesson->id} → r2");
                } elseif ($result === 'skip') {
                    $skipped++;
                } else {
                    $failed++;
                }
            } catch (\Throwable $e) {
                $failed++;
                Log::error('videos:migrate-local-to-r2 failed', [
                    'lesson_id' => $lesson->id,
                    'error' => $e->getMessage(),
                ]);
                $this->error("lesson {$lesson->id}: ".$e->getMessage());
            } finally {
                optional($lock)->release();
            }
        }

        $this->info("done ok={$ok} skipped={$skipped} failed={$failed}");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function migrateLesson(Lesson $lesson): string
    {
        $sourceKey = (string) $lesson->video_reference;
        $abs = $this->localAbsolutePath($sourceKey);
        if ($abs === null) {
            $this->warn("lesson {$lesson->id}: local file missing ({$sourceKey}), skip.");

            return 'skip';
        }

        $this->copyFileToR2($sourceKey, $abs);

        $newVariants = [];
        $variants = is_array($lesson->video_variants) ? $lesson->video_variants : [];
        foreach ($variants as $label => $path) {
            if (! is_string($path) || $path === '') {
                continue;
            }
            $vAbs = $this->localAbsolutePath($path);
            if ($vAbs === null) {
                $this->warn("lesson {$lesson->id}: variant {$label} missing, keep original path after switch.");
                $newVariants[(string) $label] = $path;

                continue;
            }
            $this->copyFileToR2($path, $vAbs);
            $newVariants[(string) $label] = $path;
        }

        if (! Storage::disk('r2')->exists($sourceKey)) {
            throw new \RuntimeException("R2 object missing after upload: {$sourceKey}");
        }

        $localSize = @filesize($abs);
        $r2Size = Storage::disk('r2')->size($sourceKey);
        if (is_int($localSize) && $localSize > 0 && (int) $r2Size !== $localSize) {
            throw new \RuntimeException("R2 size mismatch for {$sourceKey} local={$localSize} r2={$r2Size}");
        }

        $lesson->video_provider = 'r2';
        $lesson->video_reference = $sourceKey;
        if ($newVariants !== []) {
            $lesson->video_variants = $newVariants;
        }
        $lesson->save();

        if ($this->option('delete-local')) {
            $this->deleteLocal($sourceKey);
            foreach ($newVariants as $path) {
                $this->deleteLocal($path);
            }
        }

        return 'ok';
    }

    private function copyFileToR2(string $key, string $absolutePath): void
    {
        $localSize = @filesize($absolutePath);
        if (Storage::disk('r2')->exists($key)) {
            try {
                if (is_int($localSize) && $localSize > 0 && (int) Storage::disk('r2')->size($key) === $localSize) {
                    return;
                }
            } catch (\Throwable) {
                // re-upload
            }
        }

        $stream = fopen($absolutePath, 'rb');
        if ($stream === false) {
            throw new \RuntimeException("Cannot read {$absolutePath}");
        }
        try {
            $ok = Storage::disk('r2')->put($key, $stream);
            if ($ok === false) {
                throw new \RuntimeException("R2 put failed for {$key}");
            }
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    private function localAbsolutePath(string $relative): ?string
    {
        foreach (['public', 'local'] as $disk) {
            try {
                if (Storage::disk($disk)->exists($relative)) {
                    $path = Storage::disk($disk)->path($relative);

                    return is_file($path) ? $path : null;
                }
            } catch (\Throwable) {
                continue;
            }
        }

        $public = storage_path('app/public/'.ltrim($relative, '/'));
        if (is_file($public)) {
            return $public;
        }

        return null;
    }

    private function deleteLocal(string $relative): void
    {
        foreach (['public', 'local'] as $disk) {
            try {
                if (Storage::disk($disk)->exists($relative)) {
                    Storage::disk($disk)->delete($relative);
                }
            } catch (\Throwable) {
                // keep local if delete fails
            }
        }
    }
}
