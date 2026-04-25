<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Note;
use App\Services\CouponService;
use App\Services\CourseCommissionService;
use App\Services\CourseRenewalDiscountService;
use App\Services\InstructorEnrollmentWalletService;
use App\Services\ReferralService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnrollmentController extends Controller
{
    protected WalletService $walletService;
    protected CouponService $couponService;
    protected ReferralService $referralService;

    protected CourseRenewalDiscountService $renewalDiscountService;

    public function __construct(
        WalletService $walletService,
        CouponService $couponService,
        ReferralService $referralService,
        CourseRenewalDiscountService $renewalDiscountService
    ) {
        $this->walletService   = $walletService;
        $this->couponService   = $couponService;
        $this->referralService = $referralService;
        $this->renewalDiscountService = $renewalDiscountService;
    }

    /**
     * Get my enrollments.
     */
    public function index()
    {
        $enrollments = Enrollment::where('student_id', auth()->id())
            ->where('active', true)
            ->with(['course.instructor', 'course.subject', 'section', 'lesson', 'note'])
            ->orderBy('enrolled_at', 'desc')
            ->get();

        return response()->json($enrollments);
    }

    /**
     * Purchase a course, section, lesson, or individual attachment/file.
     *
     * type = full_course  → course_id required
     * type = section      → course_id + section_id required
     * type = lesson       → course_id + lesson_id required
     * type = attachment   → course_id + note_id required
     */
    public function enroll(Request $request)
    {
        $request->validate([
            'course_id'   => 'required|exists:courses,id',
            'type'        => 'required|in:full_course,section,lesson,attachment',
            'section_id'  => 'required_if:type,section|nullable|exists:course_sections,id',
            'lesson_id'   => 'required_if:type,lesson|nullable|exists:lessons,id',
            'note_id'     => 'required_if:type,attachment|nullable|exists:notes,id',
            'coupon_code' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request) {
            $course  = Course::findOrFail($request->course_id);
            $student = auth()->user();

            if (!$course->active || $course->status !== 'published') {
                return response()->json(['message' => 'This course is not available for enrollment.'], 422);
            }

            // Prevent duplicate enrollments
            $exists = Enrollment::where('student_id', $student->id)
                ->where('course_id', $course->id)
                ->where('type', $request->type)
                ->where('active', true)
                ->when($request->type === 'section', fn ($q) => $q->where('section_id', $request->section_id))
                ->when($request->type === 'lesson',  fn ($q) => $q->where('lesson_id', $request->lesson_id))
                ->when($request->type === 'attachment', fn ($q) => $q->where('note_id', $request->note_id))
                ->exists();

            if ($exists) {
                return response()->json(['message' => 'You are already enrolled.'], 422);
            }

            // Calculate price
            $price = $this->calculatePrice(
                $course,
                $request->type,
                $request->section_id,
                $request->lesson_id,
                $request->note_id
            );

            $originalPrice = $price;
            $discount = 0;
            $renewalDiscount = $this->renewalDiscountService->computeDiscountAmount($course, $student->id, $price);
            if ($renewalDiscount > 0) {
                $discount += $renewalDiscount;
                $price = max(0, round($price - $renewalDiscount, 2));
            }

            $referralDiscount = $this->referralService->computeFirstSubscriptionDiscount($student->id, $price);
            $couponCode = null;

            if ($referralDiscount > 0) {
                $discount += $referralDiscount;
                $price = max(0, round($price - $referralDiscount, 2));
            }

            // Apply coupon if provided (on price after referral discount)
            if ($request->coupon_code) {
                $couponResult = $this->couponService->validateCoupon(
                    $request->coupon_code,
                    $student->id,
                    $price
                );
                if ($couponResult['valid']) {
                    $discount   += $couponResult['discount'];
                    $price      = $couponResult['final_amount'];
                    $couponCode = $request->coupon_code;
                }
            }

            $finalPrice = $price;

            $commission = CourseCommissionService::splitForCourse($course, $finalPrice);

            // Check wallet balance
            if (!$this->walletService->hasEnoughBalance($student->id, $finalPrice)) {
                return response()->json([
                    'message'         => 'Insufficient balance.',
                    'required'        => $finalPrice,
                    'current_balance' => $this->walletService->getBalance($student->id),
                ], 400);
            }

            // Withdraw from wallet
            $this->walletService->withdraw(
                $student->id,
                $finalPrice,
                "Enrollment: {$course->title}",
                [
                    'course_id' => $course->id,
                    'type' => $request->type,
                    'referral_discount' => $referralDiscount,
                    'renewal_discount' => $renewalDiscount,
                    'admin_commission_percent' => $commission['admin_commission_percent'],
                    'platform_amount' => $commission['platform_amount'],
                    'instructor_amount' => $commission['instructor_amount'],
                ]
            );

            // Create enrollment record
            $enrollment = Enrollment::create([
                'student_id' => $student->id,
                'course_id' => $course->id,
                'type' => $request->type,
                'section_id' => $request->section_id ?? null,
                'lesson_id' => $request->lesson_id ?? null,
                'note_id' => $request->note_id ?? null,
                'original_price' => $originalPrice,
                'discount' => $discount,
                'referral_discount' => $referralDiscount,
                'renewal_discount' => $renewalDiscount,
                'final_price' => $finalPrice,
                'admin_commission_percent' => $commission['admin_commission_percent'],
                'platform_amount' => $commission['platform_amount'],
                'instructor_amount' => $commission['instructor_amount'],
                'coupon_code' => $couponCode,
                'active' => true,
                'enrolled_at' => now(),
            ]);

            // Apply coupon usage record
            if ($couponCode) {
                $this->couponService->applyCoupon($couponCode, $student->id, $enrollment->id, $originalPrice);
            }

            // Grant referral bonus on purchase
            $this->referralService->grantBonusOnPurchase($enrollment->id);

            app(InstructorEnrollmentWalletService::class)->creditInstructorForEnrollment($enrollment);

            // Increment course students count for full-course enrollment
            if ($request->type === 'full_course') {
                $course->increment('students_count');
            }

            // Notify admins
            $notificationService = app(\App\Services\NotificationService::class);
            $adminIds = \App\Models\User::where('type', 'admin')->pluck('id');
            foreach ($adminIds as $adminId) {
                $notificationService->sendToUser(
                    $adminId,
                    'اشتراك جديد',
                    "قام الطالب {$student->full_name} بالاشتراك في: {$course->title}",
                    ['course_id' => $course->id, 'student_id' => $student->id, 'type' => 'new_enrollment']
                );
            }

            return response()->json([
                'message' => 'Enrolled successfully.',
                'enrollment' => $enrollment->load(['course', 'section', 'lesson', 'note']),
                'commission' => [
                    'admin_commission_percent' => $commission['admin_commission_percent'],
                    'platform_amount' => $commission['platform_amount'],
                    'instructor_amount' => $commission['instructor_amount'],
                ],
                'renewal_discount' => $renewalDiscount,
            ], 201);
        });
    }

    /**
     * Calculate the price depending on enrollment type.
     */
    protected function calculatePrice($course, $type, $sectionId = null, $lessonId = null, $noteId = null): float
    {
        return match ($type) {
            'full_course' => (float) $course->price,
            'section'     => (float) (\App\Models\CourseSection::findOrFail($sectionId)->price ?? $course->price),
            'lesson'      => (float) (\App\Models\Lesson::findOrFail($lessonId)->price ?? $course->price),
            'attachment'  => (float) (Note::findOrFail($noteId)->price ?? 0),
            default       => 0.0,
        };
    }
}
