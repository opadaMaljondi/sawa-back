<?php

use App\Http\Controllers\Api\Admin\BannerController;
use App\Http\Controllers\Api\Admin\ChatGroupController as AdminChatGroupController;
use App\Http\Controllers\Api\Admin\CouponController as AdminCouponController;
use App\Http\Controllers\Api\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Api\Admin\CourseSectionController as AdminCourseSectionController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\DepartmentController as AdminDepartmentController;
use App\Http\Controllers\Api\Admin\ExamController as AdminExamController;
use App\Http\Controllers\Api\Admin\FinanceController as AdminFinanceController;
use App\Http\Controllers\Api\Admin\InstructorController as AdminInstructorController;
use App\Http\Controllers\Api\Admin\NoteController as AdminNoteController;
use App\Http\Controllers\Api\Admin\NotificationController as AdminNotificationController;
use App\Http\Controllers\Api\Admin\ReferralController as AdminReferralController;
use App\Http\Controllers\Api\Admin\PermissionController;
use App\Http\Controllers\Api\Admin\ProfileController as AdminProfileController;
use App\Http\Controllers\Api\Admin\ReportController;
use App\Http\Controllers\Api\Admin\RoleController;
use App\Http\Controllers\Api\Admin\SemesterController as AdminSemesterController;
use App\Http\Controllers\Api\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\Admin\StudentController as AdminStudentController;
use App\Http\Controllers\Api\Admin\SubjectController as AdminSubjectController;
use App\Http\Controllers\Api\Admin\SubscriptionController as AdminSubscriptionController;
use App\Http\Controllers\Api\Admin\VideoController as AdminVideoController;
use App\Http\Controllers\Api\Admin\WalletController as AdminWalletController;
use App\Http\Controllers\Api\Admin\YearController as AdminYearController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\InstructorAuthController;
use App\Http\Controllers\Api\Auth\StudentAuthController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\Instructor\ChatGroupController;
use App\Http\Controllers\Api\Instructor\CourseController as InstructorCourseController;
use App\Http\Controllers\Api\Instructor\ExamController;
use App\Http\Controllers\Api\Instructor\NoteController;
use App\Http\Controllers\Api\Instructor\VideoController;
use App\Http\Controllers\Api\Student\AppController as StudentAppController;
use App\Http\Controllers\Api\Student\ChatController;
use App\Http\Controllers\Api\Student\CouponController as StudentCouponController;
use App\Http\Controllers\Api\Student\CourseController as StudentCourseController;
use App\Http\Controllers\Api\Student\EnrollmentController;
use App\Http\Controllers\Api\Student\NoteController as StudentNoteController;
use App\Http\Controllers\Api\Student\ProfileController as StudentProfileController;
use App\Http\Controllers\Api\Student\ReferralController;
use App\Http\Controllers\Api\Student\SupportController as StudentSupportController;
use App\Http\Controllers\Api\Student\VideoDownloadController;
use App\Http\Controllers\Api\Student\WalletController;
use App\Models\Year;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public Routes (no token required - for registration screen)
Route::get('departments', [StudentCourseController::class, 'departments']);
Route::get('years', fn () => response()->json(Year::where('active', true)->orderBy('order')->get()));

// Public Auth Routes
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'registerStudent']);
    Route::post('login', [AuthController::class, 'login']);

    // Student Auth
    Route::prefix('student')->group(function () {
        Route::post('register', [StudentAuthController::class, 'register']);
        Route::post('login', [StudentAuthController::class, 'login']);
        Route::post('google', [StudentAuthController::class, 'googleAuth']);
    });

    // Instructor Auth
    Route::prefix('instructor')->group(function () {
        Route::post('login', [InstructorAuthController::class, 'login']);
    });
});

// تسجيل الجهاز و FCM (لأي مستخدم مسجّل دخوله: طالب، معلم، إلخ)
Route::middleware('auth:sanctum')->prefix('devices')->group(function () {
    Route::post('register', [DeviceController::class, 'register']);
    Route::put('fcm', [DeviceController::class, 'updateFcmToken']);
    Route::post('logout', [DeviceController::class, 'logoutDevice']);
});

// Student Routes
Route::middleware(['auth:sanctum', 'student'])->prefix('student')->group(function () {
    // Profile
    Route::post('profile/complete', [StudentProfileController::class, 'complete']);

    // Courses & Departments
    Route::get('home', [StudentCourseController::class, 'home']);
    Route::get('departments', [StudentCourseController::class, 'departments']);
    Route::get('departments/{id}', [StudentCourseController::class, 'departmentShow']);
    Route::get('departments/{departmentId}/courses', [StudentCourseController::class, 'coursesByYearAndSemester']);
    Route::get('courses/subject/{subjectId}', [StudentCourseController::class, 'getCoursesBySubject']);
    Route::get('courses/{courseId}', [StudentCourseController::class, 'show']);
    Route::get('courses', [StudentCourseController::class, 'search']);

    // Enrollments
    Route::get('enrollments', [EnrollmentController::class, 'index']);
    Route::post('enrollments', [EnrollmentController::class, 'enroll']);

    // Wallet
    Route::get('wallet/balance', [WalletController::class, 'balance']);
    Route::get('wallet/transactions', [WalletController::class, 'transactions']);
    Route::post('wallet/deposit', [WalletController::class, 'deposit']);

    // Video Downloads (chunk-friendly GET file: local = Range-capable binary; aws = JSON with signed URL)
    Route::get('videos/downloaded', [VideoDownloadController::class, 'downloaded']);
    Route::get('videos/{lessonId}/file', [VideoDownloadController::class, 'streamLessonFile'])->whereNumber('lessonId');
    Route::post('videos/{lessonId}/download', [VideoDownloadController::class, 'download']);
    Route::get('videos/{token}/stream', [VideoDownloadController::class, 'stream']);
    Route::delete('videos/{token}', [VideoDownloadController::class, 'delete']);

    // Chat
    Route::get('chats', [ChatController::class, 'index']);
    Route::get('chats/{chatId}/messages', [ChatController::class, 'messages']);
    Route::post('chats/{chatId}/messages', [ChatController::class, 'sendMessage']);

    // Referrals
    Route::get('referrals/code', [ReferralController::class, 'myCode']);
    Route::get('referrals/stats', [ReferralController::class, 'stats']);
    Route::get('referrals', [ReferralController::class, 'referrals']);

    // Profile
    Route::get('profile', [StudentProfileController::class, 'show']);
    Route::match(['PUT', 'POST'], 'profile', [StudentProfileController::class, 'update']);

    // Coupons
    Route::get('coupons', [StudentCouponController::class, 'index']);
    Route::post('coupons/check', [StudentCouponController::class, 'check']);

    // Saved Notes / Files
    Route::get('notes', [StudentNoteController::class, 'index']);

    // Support
    Route::get('support/info', [StudentSupportController::class, 'info']);
    Route::post('support', [StudentSupportController::class, 'send']);

    // App Info (Terms, Privacy, Settings)
    Route::get('app/terms', [StudentAppController::class, 'terms']);
    Route::get('app/privacy', [StudentAppController::class, 'privacy']);
    Route::get('app/settings', [StudentAppController::class, 'settings']);
});

// Instructor Routes
Route::middleware(['auth:sanctum', 'instructor'])->prefix('instructor')->group(function () {
    // Courses
    Route::get('courses', [InstructorCourseController::class, 'index']);
    Route::post('courses', [InstructorCourseController::class, 'store']);
    Route::match(['put', 'post'], 'courses/{courseId}', [InstructorCourseController::class, 'update']);
    Route::get('courses/{courseId}/stats', [InstructorCourseController::class, 'stats']);

    // Videos
    Route::post('videos', [VideoController::class, 'upload']);
    Route::put('videos/{lessonId}', [VideoController::class, 'update']);
    Route::delete('videos/{lessonId}', [VideoController::class, 'destroy']);
    Route::post('courses/{courseId}/make-first-free', [VideoController::class, 'makeFirstFree']);

    // Notes
    Route::get('courses/{courseId}/notes', [NoteController::class, 'index']);
    Route::post('notes', [NoteController::class, 'store']);
    Route::put('notes/{noteId}', [NoteController::class, 'update']);
    Route::delete('notes/{noteId}', [NoteController::class, 'destroy']);

    // Exams
    Route::get('courses/{courseId}/exams', [ExamController::class, 'index']);
    Route::post('exams', [ExamController::class, 'store']);
    Route::match(['put', 'post'], 'exams/{examId}', [ExamController::class, 'update']);
    Route::delete('exams/{examId}', [ExamController::class, 'destroy']);

    // Chat Groups
    Route::get('chat-groups', [ChatGroupController::class, 'index']);
    Route::post('chat-groups', [ChatGroupController::class, 'store']);
    Route::put('chat-groups/{chatId}', [ChatGroupController::class, 'update']);
    Route::delete('chat-groups/{chatId}', [ChatGroupController::class, 'destroy']);
    Route::get('courses/{courseId}/enrollments-report', [ChatGroupController::class, 'enrollmentsReport']);
});

// Admin Routes
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    // Dashboard
    Route::get('dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('dashboard/top-courses', [DashboardController::class, 'topCourses']);
    Route::get('dashboard/recent-enrollments', [DashboardController::class, 'recentEnrollments']);
    Route::get('dashboard/pending-courses', [DashboardController::class, 'pendingCourses']);
    Route::get('dashboard/revenue-by-instructor', [DashboardController::class, 'revenueByInstructor']);
    Route::get('dashboard/revenue-by-department', [DashboardController::class, 'revenueByDepartment']);
    Route::get('dashboard/student-growth', [DashboardController::class, 'studentGrowth']);
    Route::get('dashboard/recent-transactions', [DashboardController::class, 'recentTransactions']);
    Route::get('dashboard/coupon-stats', [DashboardController::class, 'couponStats']);
    Route::get('dashboard/support', [DashboardController::class, 'support']);
    Route::put('dashboard/support/{id}/status', [DashboardController::class, 'updateSupportStatus']);

    // Students
    Route::get('students', [AdminStudentController::class, 'index']);
    Route::post('students', [AdminStudentController::class, 'store']);
    Route::get('students/{studentId}/wallet-qr-preview', [AdminStudentController::class, 'walletQrPreview']);
    Route::get('students/{studentId}', [AdminStudentController::class, 'show']);
    Route::put('students/{studentId}', [AdminStudentController::class, 'update']);
    Route::post('students/{studentId}/enroll', [AdminStudentController::class, 'enrollStudent']);
    Route::post('students/{studentId}/wallet', [AdminStudentController::class, 'updateWallet']);
    Route::post('students/{studentId}/toggle-ban', [AdminStudentController::class, 'toggleBan']);
    Route::delete('students/{studentId}', [AdminStudentController::class, 'destroy']);

    // Instructors
    Route::get('instructors/finance-summary', [AdminInstructorController::class, 'financeSummary']);
    Route::get('instructors', [AdminInstructorController::class, 'index']);
    Route::post('instructors', [AdminInstructorController::class, 'store']);
    Route::get('instructors/{instructorId}', [AdminInstructorController::class, 'show']);
    Route::match(['put', 'post'], 'instructors/{instructorId}', [AdminInstructorController::class, 'update']);
    Route::put('instructors/{instructorId}/permissions', [AdminInstructorController::class, 'updatePermissions']);
    Route::get('instructors/{instructorId}/wallet-overview', [AdminInstructorController::class, 'walletOverview']);
    Route::post('instructors/{instructorId}/wallet', [AdminInstructorController::class, 'updateWallet']);
    Route::post('instructors/{instructorId}/toggle-suspend', [AdminInstructorController::class, 'toggleSuspend']);
    Route::post('instructors/{instructorId}/courses', [AdminInstructorController::class, 'createCourse']);
    Route::delete('instructors/{instructorId}', [AdminInstructorController::class, 'destroy']);

    // Courses (إنشاء وتعديل وإحصائيات مثل الاستاذ)
    Route::get('courses', [AdminCourseController::class, 'index']);
    Route::post('courses', [AdminCourseController::class, 'store']);
    Route::get('courses/{courseId}', [AdminCourseController::class, 'show']);
    Route::match(['put', 'post'], 'courses/{courseId}', [AdminCourseController::class, 'update']);
    Route::get('courses/{courseId}/stats', [AdminCourseController::class, 'stats']);
    Route::get('courses/{courseId}/subscriptions', [AdminCourseController::class, 'subscriptions']);
    Route::post('courses/{courseId}/approve', [AdminCourseController::class, 'approve']);
    Route::post('courses/{courseId}/reject', [AdminCourseController::class, 'reject']);
    Route::post('courses/{courseId}/suspend', [AdminCourseController::class, 'suspend']);
    Route::post('courses/{courseId}/activate', [AdminCourseController::class, 'activate']);
    Route::delete('courses/{courseId}', [AdminCourseController::class, 'destroy']);

    // Course Sections CRUD
    Route::get('course-sections', [AdminCourseSectionController::class, 'index']);
    Route::post('course-sections', [AdminCourseSectionController::class, 'store']);
    Route::get('course-sections/{id}', [AdminCourseSectionController::class, 'show']);
    Route::put('course-sections/{id}', [AdminCourseSectionController::class, 'update']);
    Route::delete('course-sections/{id}', [AdminCourseSectionController::class, 'destroy']);

    // Videos (رفع وتعديل وحذف فيديوهات لأي كورس)
    Route::post('videos/chunk', [AdminVideoController::class, 'uploadChunk']);
    Route::post('videos/chunk/complete', [AdminVideoController::class, 'completeChunkUpload']);
    Route::post('videos', [AdminVideoController::class, 'upload']);
    Route::put('videos/{lessonId}', [AdminVideoController::class, 'update']);
    Route::delete('videos/{lessonId}', [AdminVideoController::class, 'destroy']);
    Route::post('courses/{courseId}/make-first-free', [AdminVideoController::class, 'makeFirstFree']);

    // Notes (ملاحظات لأي كورس)
    Route::get('notes', [AdminNoteController::class, 'indexAll']);
    Route::get('courses/{courseId}/notes', [AdminNoteController::class, 'index']);
    Route::post('notes', [AdminNoteController::class, 'store']);
    Route::put('notes/{noteId}', [AdminNoteController::class, 'update']);
    Route::delete('notes/{noteId}', [AdminNoteController::class, 'destroy']);

    // Exams (امتحانات لأي كورس)
    Route::get('courses/{courseId}/exams', [AdminExamController::class, 'index']);
    Route::post('exams', [AdminExamController::class, 'store']);
    Route::match(['put', 'post'], 'exams/{examId}', [AdminExamController::class, 'update']);
    Route::delete('exams/{examId}', [AdminExamController::class, 'destroy']);

    // Chat Groups (مجموعات دردشة لأي كورس)
    Route::get('chat-groups', [AdminChatGroupController::class, 'index']);
    Route::post('chat-groups', [AdminChatGroupController::class, 'store']);
    Route::put('chat-groups/{chatId}', [AdminChatGroupController::class, 'update']);
    Route::delete('chat-groups/{chatId}', [AdminChatGroupController::class, 'destroy']);
    Route::get('courses/{courseId}/enrollments-report', [AdminChatGroupController::class, 'enrollmentsReport']);

    // Notifications (إشعارات عامة / فرع / كورس)
    Route::get('notifications', [AdminNotificationController::class, 'index']);
    Route::get('notifications/unread-count', [AdminNotificationController::class, 'getUnreadCount']);
    Route::post('notifications/{id}/read', [AdminNotificationController::class, 'markAsRead']);
    Route::post('notifications/send', [AdminNotificationController::class, 'send']);

    // عرض واجهة الطالب (Home - بانرات وأقسام)
    Route::get('student-view/home', [StudentCourseController::class, 'home']);
    Route::get('student-view/departments', [StudentCourseController::class, 'departments']);
    Route::get('student-view/courses/subject/{subjectId}', [StudentCourseController::class, 'getCoursesBySubject']);
    Route::get('student-view/courses', [StudentCourseController::class, 'search']);
    Route::get('student-view/courses/{courseId}', [StudentCourseController::class, 'show']);

    // Departments CRUD
    Route::get('departments', [AdminDepartmentController::class, 'index']);
    Route::post('departments', [AdminDepartmentController::class, 'store']);
    Route::get('departments/{id}', [AdminDepartmentController::class, 'show']);
    Route::put('departments/{id}', [AdminDepartmentController::class, 'update']);
    Route::delete('departments/{id}', [AdminDepartmentController::class, 'destroy']);

    // Years CRUD
    Route::get('years', [AdminYearController::class, 'index']);
    Route::post('years', [AdminYearController::class, 'store']);
    Route::get('years/{id}', [AdminYearController::class, 'show']);
    Route::put('years/{id}', [AdminYearController::class, 'update']);
    Route::delete('years/{id}', [AdminYearController::class, 'destroy']);

    // Subjects CRUD
    Route::get('subjects', [AdminSubjectController::class, 'index']);
    Route::post('subjects', [AdminSubjectController::class, 'store']);
    Route::get('subjects/{id}', [AdminSubjectController::class, 'show']);
    Route::put('subjects/{id}', [AdminSubjectController::class, 'update']);
    Route::delete('subjects/{id}', [AdminSubjectController::class, 'destroy']);

    // Semesters CRUD
    Route::get('semesters', [AdminSemesterController::class, 'index']);
    Route::post('semesters', [AdminSemesterController::class, 'store']);
    Route::get('semesters/{id}', [AdminSemesterController::class, 'show']);
    Route::put('semesters/{id}', [AdminSemesterController::class, 'update']);
    Route::delete('semesters/{id}', [AdminSemesterController::class, 'destroy']);

    // Coupons (admin CRUD)
    Route::get('coupons', [AdminCouponController::class, 'index']);
    Route::post('coupons', [AdminCouponController::class, 'store']);
    Route::put('coupons/{couponId}', [AdminCouponController::class, 'update']);
    Route::delete('coupons/{couponId}', [AdminCouponController::class, 'destroy']);

    // Banners
    Route::get('banners', [BannerController::class, 'index']);
    Route::post('banners', [BannerController::class, 'store']);
    Route::put('banners/{bannerId}', [BannerController::class, 'update']);
    Route::delete('banners/{bannerId}', [BannerController::class, 'destroy']);

    // Roles and Permissions
    Route::apiResource('roles', RoleController::class);
    Route::post('roles/{id}/permissions', [RoleController::class, 'syncPermissions']);
    Route::get('permissions', [PermissionController::class, 'index']);

    // Enrollments as Subscriptions
    Route::get('subscriptions', [AdminSubscriptionController::class, 'index']);
    Route::get('subscriptions/{id}', [AdminSubscriptionController::class, 'show']);
    Route::post('subscriptions/{id}/toggle-status', [AdminSubscriptionController::class, 'toggleStatus']);
    Route::post('subscriptions/{id}/refund', [AdminSubscriptionController::class, 'refund']);

    // Referrals (admin dashboard) — `/stats` before list if you later add `referrals/{id}`
    Route::get('referrals/stats', [AdminReferralController::class, 'stats']);
    Route::get('referrals', [AdminReferralController::class, 'index']);

    // Finance aggregates (admin dashboard)
    Route::get('finance/platform-totals', [AdminFinanceController::class, 'platformTotals']);

    // Wallets
    Route::get('wallets', [AdminWalletController::class, 'index']);
    Route::get('wallets/transactions', [AdminWalletController::class, 'transactions']);
    Route::get('wallets/{userId}', [AdminWalletController::class, 'show']);
    Route::post('wallets/{userId}/adjust', [AdminWalletController::class, 'adjust']);

    // Settings
    Route::get('settings', [AdminSettingController::class, 'index']);
    Route::post('settings', [AdminSettingController::class, 'update']);

    // Profile
    Route::get('profile', [AdminProfileController::class, 'show']);
    Route::post('profile', [AdminProfileController::class, 'update']);

    // Reports
    Route::get('reports/revenue', [ReportController::class, 'revenue']);
    Route::get('reports/course-performance', [ReportController::class, 'coursePerformance']);
    Route::get('reports/instructor-performance', [ReportController::class, 'instructorPerformance']);
});

// Logout (for all users)
Route::middleware('auth:sanctum')->post('logout', function (Request $request) {
    $request->user()->currentAccessToken()->delete();

    return response()->json(['message' => 'Logged out successfully']);
});
