<?php

namespace App\Console\Commands;

use App\Models\Course;
use App\Models\Enrollment;
use App\Services\InstructorEnrollmentWalletService;
use Illuminate\Console\Command;

class DeactivateEnrollmentsForExpiredCourses extends Command
{
    protected $signature = 'courses:deactivate-expired-enrollments';

    protected $description = 'تعطيل جميع الاشتراكات النشطة للكورسات التي تجاوزت تاريخ الانتهاء (دون حذف) وخصم حصص الأساتذة من المحافظ';

    public function handle(InstructorEnrollmentWalletService $walletService): int
    {
        $courseIds = Course::query()
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<', now()->toDateString())
            ->pluck('id');

        if ($courseIds->isEmpty()) {
            $this->info('No expired courses found.');

            return self::SUCCESS;
        }

        $count = 0;

        Enrollment::query()
            ->whereIn('course_id', $courseIds)
            ->where('active', true)
            ->with('course')
            ->chunkById(200, function ($rows) use ($walletService, &$count) {
                foreach ($rows as $enrollment) {
                    if (! $enrollment->course) {
                        continue;
                    }
                    $walletService->onEnrollmentActiveChanged($enrollment, true, false);
                    $enrollment->update(['active' => false]);
                    $count++;
                }
            });

        $this->info("Deactivated {$count} enrollment(s) for expired courses.");

        return self::SUCCESS;
    }
}
