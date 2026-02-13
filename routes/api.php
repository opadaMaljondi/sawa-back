<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\StudentAuthController;
use App\Http\Controllers\Api\Auth\InstructorAuthController;
use App\Http\Controllers\Api\Student\CourseController as StudentCourseController;
use App\Http\Controllers\Api\Student\EnrollmentController;
use App\Http\Controllers\Api\Student\WalletController;
use App\Http\Controllers\Api\Student\VideoDownloadController;
use App\Http\Controllers\Api\Student\ChatController;
use App\Http\Controllers\Api\Student\ReferralController;
use App\Http\Controllers\Api\Instructor\CourseController as InstructorCourseController;
use App\Http\Controllers\Api\Instructor\VideoController;
use App\Http\Controllers\Api\Instructor\NoteController;
use App\Http\Controllers\Api\Instructor\ExamController;
use App\Http\Controllers\Api\Instructor\ChatGroupController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\StudentController as AdminStudentController;
use App\Http\Controllers\Api\Admin\InstructorController as AdminInstructorController;
use App\Http\Controllers\Api\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Api\Admin\BannerController;
use App\Http\Controllers\Api\Admin\ReportController;

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

// Public Auth Routes
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'registerStudent']);
    Route::post('login', [AuthController::class, 'login']);
    
    // Student Auth
    Route::prefix('student')->group(function () {
        Route::post('register', [StudentAuthController::class, 'register']);
        Route::post('login', [StudentAuthController::class, 'login']);
    });
    
    // Instructor Auth
    Route::prefix('instructor')->group(function () {
        Route::post('login', [InstructorAuthController::class, 'login']);
    });
});

// Student Routes
Route::middleware(['auth:sanctum', 'student'])->prefix('student')->group(function () {
    // Courses
    Route::get('home', [StudentCourseController::class, 'home']);
    Route::get('departments', [StudentCourseController::class, 'departments']);
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
    
    // Video Downloads
    Route::get('videos/downloaded', [VideoDownloadController::class, 'downloaded']);
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
});

// Instructor Routes
Route::middleware(['auth:sanctum', 'instructor'])->prefix('instructor')->group(function () {
    // Courses
    Route::get('courses', [InstructorCourseController::class, 'index']);
    Route::post('courses', [InstructorCourseController::class, 'store']);
    Route::put('courses/{courseId}', [InstructorCourseController::class, 'update']);
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
    Route::put('exams/{examId}', [ExamController::class, 'update']);
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
    
    // Students
    Route::get('students', [AdminStudentController::class, 'index']);
    Route::get('students/{studentId}', [AdminStudentController::class, 'show']);
    Route::post('students/{studentId}/enroll', [AdminStudentController::class, 'enrollStudent']);
    Route::post('students/{studentId}/wallet', [AdminStudentController::class, 'updateWallet']);
    Route::post('students/{studentId}/toggle-ban', [AdminStudentController::class, 'toggleBan']);
    
    // Instructors
    Route::get('instructors', [AdminInstructorController::class, 'index']);
    Route::post('instructors', [AdminInstructorController::class, 'store']);
    Route::get('instructors/{instructorId}', [AdminInstructorController::class, 'show']);
    Route::put('instructors/{instructorId}/permissions', [AdminInstructorController::class, 'updatePermissions']);
    Route::post('instructors/{instructorId}/toggle-suspend', [AdminInstructorController::class, 'toggleSuspend']);
    Route::post('instructors/{instructorId}/courses', [AdminInstructorController::class, 'createCourse']);
    
    // Courses
    Route::get('courses', [AdminCourseController::class, 'index']);
    Route::get('courses/{courseId}', [AdminCourseController::class, 'show']);
    Route::post('courses/{courseId}/approve', [AdminCourseController::class, 'approve']);
    Route::post('courses/{courseId}/reject', [AdminCourseController::class, 'reject']);
    Route::post('courses/{courseId}/suspend', [AdminCourseController::class, 'suspend']);
    Route::post('courses/{courseId}/activate', [AdminCourseController::class, 'activate']);
    Route::post('courses/{courseId}/set-expiry', [AdminCourseController::class, 'setExpiry']);
    Route::delete('courses/{courseId}', [AdminCourseController::class, 'destroy']);
    
    // Banners
    Route::get('banners', [BannerController::class, 'index']);
    Route::post('banners', [BannerController::class, 'store']);
    Route::put('banners/{bannerId}', [BannerController::class, 'update']);
    Route::delete('banners/{bannerId}', [BannerController::class, 'destroy']);
    
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
