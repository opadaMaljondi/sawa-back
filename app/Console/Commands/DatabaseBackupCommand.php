<?php

namespace App\Console\Commands;

use App\Services\GoogleDriveBackupService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class DatabaseBackupCommand extends Command
{
    protected $signature = 'database:backup {--keep= : عدد النسخ المحتفظ بها (افتراضي من الإعدادات)}';

    protected $description = 'نسخ احتياطي لقاعدة البيانات في مجلد backup مع الإبقاء على آخر نسخ فقط';

    public function handle(): int
    {
        $connectionName = (string) config('database.default');
        $config = config("database.connections.{$connectionName}");
        if (! is_array($config)) {
            $this->error('إعدادات الاتصال بقاعدة البيانات غير صالحة.');

            return self::FAILURE;
        }

        $dir = rtrim((string) config('backup.database_directory'), DIRECTORY_SEPARATOR);
        $keep = (int) ($this->option('keep') ?: config('backup.keep_database_files', 3));
        $keep = max(1, $keep);

        if (! File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true);
        }

        $basename = 'db-backup-'.now()->format('Y-m-d-His');
        $sqlPath = $dir.DIRECTORY_SEPARATOR.$basename.'.sql';

        $driver = $config['driver'] ?? '';

        try {
            match ($driver) {
                'mysql' => $this->dumpMysql($config, $sqlPath),
                'sqlite' => $this->dumpSqlite($config, $sqlPath),
                default => throw new \RuntimeException("نوع قاعدة البيانات غير مدعوم للنسخ الاحتياطي: {$driver}"),
            };
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            if (File::exists($sqlPath)) {
                @unlink($sqlPath);
            }

            return self::FAILURE;
        }

        $this->pruneOldBackups($dir, $keep);
        $this->info("تم إنشاء النسخة: {$sqlPath}");

        $driveUploader = app(GoogleDriveBackupService::class);
        if ($driveUploader->isConfigured()) {
            try {
                $driveUploader->uploadAndMaintainRetention($sqlPath);
                $this->info('تم الرفع إلى Google Drive.');
            } catch (\Throwable $e) {
                Log::warning('database:backup Google Drive upload failed: '.$e->getMessage(), [
                    'path' => $sqlPath,
                ]);
                $this->warn('تعذّر الرفع إلى Google Drive: '.$e->getMessage());
            }
        }

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function dumpMysql(array $config, string $outputPath): void
    {
        $binary = (string) config('backup.mysqldump_path', 'mysqldump');
        $database = (string) ($config['database'] ?? '');
        $username = (string) ($config['username'] ?? '');
        $password = (string) ($config['password'] ?? '');
        $host = (string) ($config['host'] ?? '127.0.0.1');
        $port = (string) ($config['port'] ?? '3306');
        $socket = (string) ($config['unix_socket'] ?? '');

        if ($database === '') {
            throw new \RuntimeException('اسم قاعدة البيانات غير محدد.');
        }

        $args = array_merge(
            [$binary],
            $socket !== ''
                ? ['--socket='.$socket]
                : ['--host='.$host, '--port='.$port],
            [
                '--user='.$username,
                '--password='.$password,
                '--single-transaction',
                '--skip-lock-tables',
                '--default-character-set=utf8mb4',
                $database,
            ]
        );

        $process = new Process($args);
        $process->setTimeout(3600);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException(
                'فشل mysqldump: '.$process->getErrorOutput().$process->getOutput()
            );
        }

        File::put($outputPath, $process->getOutput());
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function dumpSqlite(array $config, string $outputPath): void
    {
        $dbPath = $config['database'] ?? '';
        if ($dbPath === '') {
            throw new \RuntimeException('مسار ملف SQLite غير محدد.');
        }
        $resolved = str_starts_with((string) $dbPath, DIRECTORY_SEPARATOR)
            || preg_match('#^[A-Za-z]:\\\\#', (string) $dbPath) === 1
            ? (string) $dbPath
            : base_path((string) $dbPath);

        if (! is_file($resolved)) {
            throw new \RuntimeException("ملف SQLite غير موجود: {$resolved}");
        }

        if (! @copy($resolved, $outputPath)) {
            throw new \RuntimeException('فشل نسخ ملف SQLite.');
        }
    }

    private function pruneOldBackups(string $directory, int $keep): void
    {
        $files = collect(File::files($directory))
            ->filter(fn (\SplFileInfo $f) => str_starts_with($f->getFilename(), 'db-backup-')
                && str_ends_with($f->getFilename(), '.sql'))
            ->sortByDesc(fn (\SplFileInfo $f) => $f->getMTime())
            ->values();

        foreach ($files->slice($keep) as $file) {
            @unlink($file->getPathname());
        }
    }
}
