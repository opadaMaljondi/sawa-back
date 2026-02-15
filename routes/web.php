<?php

use App\Http\Controllers\YouTubeAuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

// YouTube OAuth – لتفعيل رفع الفيديو إلى YouTube (مرة واحدة)
Route::get('/youtube/auth', [YouTubeAuthController::class, 'redirectToGoogle'])->name('youtube.auth');
Route::get('/youtube/callback', [YouTubeAuthController::class, 'handleCallback'])->name('youtube.callback');
