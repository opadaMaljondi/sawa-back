<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add specialty and bio to users (for instructors)
        Schema::table('users', function (Blueprint $table) {
            $table->string('specialty')->nullable()->after('image');
            $table->text('bio')->nullable()->after('specialty');
        });

        // Add note_id to enrollments
        Schema::table('enrollments', function (Blueprint $table) {
            $table->foreignId('note_id')->nullable()->constrained('notes')->nullOnDelete()->after('lesson_id');
        });

        // Extend the type enum to include 'note'
        DB::statement("ALTER TABLE enrollments MODIFY COLUMN type ENUM('full_course','section','lesson','note') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE enrollments MODIFY COLUMN type ENUM('full_course','section','lesson') NOT NULL");

        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropForeign(['note_id']);
            $table->dropColumn('note_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['specialty', 'bio']);
        });
    }
};
