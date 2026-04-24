<?php

namespace App\Console\Commands;

use App\Services\InstructorEnrollmentWalletService;
use Illuminate\Console\Command;

class SyncInstructorWalletsFromEnrollments extends Command
{
    protected $signature = 'wallet:sync-instructor-earnings
                            {--instructor= : معرف أستاذ واحد فقط (اختياري)}';

    protected $description = 'ضبط رصيد محفظة كل أستاذ ليساوي مجموع حصته من الاشتراكات النشطة (للمزامنة بعد الترقية)';

    public function handle(InstructorEnrollmentWalletService $service): int
    {
        if ($this->option('instructor')) {
            $id = (int) $this->option('instructor');
            $balance = $service->syncInstructorBalanceFromActiveEnrollments($id);
            $this->info("Instructor {$id} wallet balance set to {$balance}.");

            return self::SUCCESS;
        }

        $n = $service->syncAllInstructorBalancesFromActiveEnrollments();
        $this->info("Synced {$n} instructor wallet(s) from active enrollments.");

        return self::SUCCESS;
    }
}
