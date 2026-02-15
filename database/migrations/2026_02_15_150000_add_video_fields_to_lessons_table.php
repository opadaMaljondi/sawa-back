<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->foreignId('course_id')->nullable()->after('id')->constrained('courses')->onDelete('cascade');
            $table->string('video_provider', 50)->nullable()->after('thumbnail'); // youtube, local
            $table->string('video_reference', 500)->nullable()->after('video_provider'); // youtube id or local path
        });
    }

    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropForeign(['course_id']);
            $table->dropColumn(['video_provider', 'video_reference']);
        });
    }
};
