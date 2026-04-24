<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\Log;

/**
 * ربط محفظة الأستاذ بحصته من اشتراكات كورساته (instructor_amount).
 */
final class InstructorEnrollmentWalletService
{
    public function __construct(protected WalletService $walletService) {}

    public static function resolveInstructorShare(Enrollment $enrollment): float
    {
        $enrollment->loadMissing('course');
        $course = $enrollment->course;
        if (! $course) {
            return 0.0;
        }
        $final = (float) $enrollment->final_price;
        if ($enrollment->platform_amount !== null && $enrollment->instructor_amount !== null) {
            return (float) $enrollment->instructor_amount;
        }

        return CourseCommissionService::splitForCourse($course, $final)['instructor_amount'];
    }

    /**
     * إيداع حصة الأستاذ بعد إنشاء اشتراك نشط.
     */
    public function creditInstructorForEnrollment(Enrollment $enrollment): void
    {
        if (! $enrollment->active) {
            return;
        }
        $amount = self::resolveInstructorShare($enrollment);
        if ($amount <= 0) {
            return;
        }
        $enrollment->loadMissing('course');
        $instructorId = $enrollment->course?->instructor_id;
        if (! $instructorId) {
            return;
        }

        $this->walletService->deposit(
            $instructorId,
            $amount,
            'حصة الأستاذ من اشتراك',
            [
                'enrollment_id' => $enrollment->id,
                'course_id' => $enrollment->course_id,
                'source' => 'enrollment_credit',
            ]
        );
    }

    /**
     * عند تفعيل/إيقاف الاشتراك: إيداع أو خصم حصة الأستاذ بما يطابق حالة «نشط».
     */
    public function onEnrollmentActiveChanged(Enrollment $enrollment, bool $wasActive, bool $nowActive): void
    {
        if ($wasActive === $nowActive) {
            return;
        }
        $amount = self::resolveInstructorShare($enrollment);
        if ($amount <= 0) {
            return;
        }
        $enrollment->loadMissing('course');
        $instructorId = $enrollment->course?->instructor_id;
        if (! $instructorId) {
            return;
        }

        if ($wasActive && ! $nowActive) {
            $this->safeWithdrawInstructor(
                $instructorId,
                $amount,
                'خصم حصة الأستاذ (إيقاف اشتراك)',
                [
                    'enrollment_id' => $enrollment->id,
                    'course_id' => $enrollment->course_id,
                    'source' => 'enrollment_deactivate',
                ]
            );
        } elseif (! $wasActive && $nowActive) {
            $this->walletService->deposit(
                $instructorId,
                $amount,
                'حصة الأستاذ من اشتراك (إعادة تفعيل)',
                [
                    'enrollment_id' => $enrollment->id,
                    'course_id' => $enrollment->course_id,
                    'source' => 'enrollment_reactivate',
                ]
            );
        }
    }

    /**
     * عند استرداد مبلغ للطالب: خصم نسبة من حصة الأستاذ بما يعادل المبلغ المسترد.
     */
    public function clawbackInstructorShareForRefund(Enrollment $enrollment, float $refundAmount): void
    {
        $final = (float) $enrollment->final_price;
        if ($final <= 0 || $refundAmount <= 0) {
            return;
        }
        $totalShare = self::resolveInstructorShare($enrollment);
        if ($totalShare <= 0) {
            return;
        }
        $ratio = min(1.0, $refundAmount / $final);
        $claw = round($totalShare * $ratio, 2);
        if ($claw <= 0) {
            return;
        }
        $enrollment->loadMissing('course');
        $instructorId = $enrollment->course?->instructor_id;
        if (! $instructorId) {
            return;
        }

        $this->safeWithdrawInstructor(
            $instructorId,
            $claw,
            'خصم حصة الأستاذ (استرداد اشتراك)',
            [
                'enrollment_id' => $enrollment->id,
                'course_id' => $enrollment->course_id,
                'refund_amount' => $refundAmount,
                'source' => 'enrollment_refund_clawback',
            ]
        );
    }

    /**
     * مزامنة رصيد محفظة الأستاذ مع مجموع حصته من الاشتراكات النشطة فقط (لمرة واحدة بعد الترقية).
     */
    public function syncInstructorBalanceFromActiveEnrollments(int $instructorId): float
    {
        $user = User::query()->where('id', $instructorId)->where('type', 'instructor')->first();
        if (! $user) {
            return 0.0;
        }

        $target = $this->computeActiveEnrollmentShareTotal($instructorId);

        $wallet = Wallet::firstOrCreate(
            ['user_id' => $instructorId],
            ['balance' => 0, 'currency' => 'SYP']
        );
        $wallet->balance = round($target, 2);
        $wallet->save();

        return (float) $wallet->balance;
    }

    public function syncAllInstructorBalancesFromActiveEnrollments(): int
    {
        $count = 0;
        User::query()->where('type', 'instructor')->select('id')->chunkById(100, function ($chunk) use (&$count) {
            foreach ($chunk as $row) {
                $this->syncInstructorBalanceFromActiveEnrollments((int) $row->id);
                $count++;
            }
        });

        return $count;
    }

    public function computeActiveEnrollmentShareTotal(int $instructorId): float
    {
        $courseIds = Course::query()->where('instructor_id', $instructorId)->pluck('id');
        if ($courseIds->isEmpty()) {
            return 0.0;
        }

        $enrollments = Enrollment::query()
            ->whereIn('course_id', $courseIds)
            ->where('active', true)
            ->with(['course:id,admin_commission'])
            ->get(['id', 'course_id', 'final_price', 'platform_amount', 'instructor_amount']);

        $sum = 0.0;
        foreach ($enrollments as $e) {
            $sum += self::resolveInstructorShare($e);
        }

        return round($sum, 2);
    }

    private function safeWithdrawInstructor(int $instructorId, float $amount, string $title, array $meta): void
    {
        try {
            $this->walletService->withdraw($instructorId, $amount, $title, $meta);
        } catch (\InvalidArgumentException $e) {
            Log::warning('Instructor wallet withdraw failed (insufficient balance)', [
                'instructor_id' => $instructorId,
                'amount' => $amount,
                'meta' => $meta,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
