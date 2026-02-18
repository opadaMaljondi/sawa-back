<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\CouponService;
use App\Services\ReferralService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnrollmentController extends Controller
{
    protected WalletService $walletService;

    protected CouponService $couponService;

    protected ReferralService $referralService;

    public function __construct(
        WalletService $walletService,
        CouponService $couponService,
        ReferralService $referralService
    ) {
        $this->walletService = $walletService;
        $this->couponService = $couponService;
        $this->referralService = $referralService;
    }

    /**
     * Get my enrollments
     */
    public function index()
    {
        $enrollments = Enrollment::where('student_id', auth()->id())
            ->where('active', true)
            ->with(['course.instructor', 'course.subject', 'section', 'lesson'])
            ->orderBy('enrolled_at', 'desc')
            ->get();

        return response()->json($enrollments);
    }

    /**
     * Enroll in course/section/lesson
     */
    public function enroll(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'type' => 'required|in:full_course,section,lesson',
            'section_id' => 'required_if:type,section|exists:course_sections,id',
            'lesson_id' => 'required_if:type,lesson|exists:lessons,id',
            'coupon_code' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request) {
            $course = Course::findOrFail($request->course_id);

            if (! $course->active || $course->status !== 'published') {
                return response()->json([
                    'message' => 'This course is not available for enrollment.',
                ], 422);
            }

            $student = auth()->user();

            // حساب السعر
            $price = $this->calculatePrice($course, $request->type, $request->section_id, $request->lesson_id);
            $originalPrice = $price;
            $discount = 0;
            $couponCode = null;

            // تطبيق الكوبون إن وجد
            if ($request->coupon_code) {
                $couponValidation = $this->couponService->validateCoupon(
                    $request->coupon_code,
                    $student->id,
                    $price
                );

                if ($couponValidation['valid']) {
                    $discount = $couponValidation['discount'];
                    $price = $couponValidation['final_amount'];
                    $couponCode = $request->coupon_code;
                }
            }

            $finalPrice = $price;

            // التحقق من الرصيد
            if (! $this->walletService->hasEnoughBalance($student->id, $finalPrice)) {
                return response()->json([
                    'message' => 'Insufficient balance',
                    'required' => $finalPrice,
                    'current_balance' => $this->walletService->getBalance($student->id),
                ], 400);
            }

            // خصم المبلغ من المحفظة
            $this->walletService->withdraw(
                $student->id,
                $finalPrice,
                "Enrollment in {$course->title}",
                [
                    'course_id' => $course->id,
                    'type' => $request->type,
                ]
            );

            // إنشاء الاشتراك
            $enrollment = Enrollment::create([
                'student_id' => $student->id,
                'course_id' => $course->id,
                'type' => $request->type,
                'section_id' => $request->section_id ?? null,
                'lesson_id' => $request->lesson_id ?? null,
                'original_price' => $originalPrice,
                'discount' => $discount,
                'final_price' => $finalPrice,
                'coupon_code' => $couponCode,
                'active' => true,
                'enrolled_at' => now(),
            ]);

            // تطبيق الكوبون
            if ($couponCode) {
                $this->couponService->applyCoupon(
                    $couponCode,
                    $student->id,
                    $enrollment->id,
                    $originalPrice
                );
            }

            // منح مكافأة الإحالة
            $this->referralService->grantBonusOnPurchase($enrollment->id);

            // تحديث عدد الطلاب
            if ($request->type === 'full_course') {
                $course->increment('students_count');
            }

            // إرسال إشعار للآدمن
            $notificationService = app(\App\Services\NotificationService::class);
            $adminIds = \App\Models\User::where('type', 'admin')->pluck('id')->toArray();
            foreach ($adminIds as $adminId) {
                $notificationService->sendToUser(
                    $adminId,
                    'اشتراك جديد في كورس',
                    "قام الطالب {$student->full_name} بالاشتراك في كورس: {$course->title}",
                    ['course_id' => $course->id, 'student_id' => $student->id, 'type' => 'new_enrollment']
                );
            }

            return response()->json([
                'message' => 'Enrolled successfully',
                'enrollment' => $enrollment->load(['course', 'section', 'lesson']),
            ], 201);
        });
    }

    /**
     * Calculate price based on enrollment type
     */
    protected function calculatePrice($course, $type, $sectionId = null, $lessonId = null)
    {
        return match ($type) {
            'full_course' => $course->price,
            'section' => \App\Models\CourseSection::findOrFail($sectionId)->price ?? $course->price,
            'lesson' => \App\Models\Lesson::findOrFail($lessonId)->price ?? $course->price,
            default => 0,
        };
    }
}
