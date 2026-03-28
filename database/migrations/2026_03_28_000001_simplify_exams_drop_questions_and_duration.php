<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('exam_questions');

        if (Schema::hasTable('exams') && Schema::hasColumn('exams', 'duration')) {
            Schema::table('exams', function (Blueprint $table) {
                $table->dropColumn('duration');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('exams') && ! Schema::hasColumn('exams', 'duration')) {
            Schema::table('exams', function (Blueprint $table) {
                $table->integer('duration')->nullable()->after('description');
            });
        }

        Schema::create('exam_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->onDelete('cascade');
            $table->string('question');
            $table->enum('type', ['multiple_choice', 'true_false', 'short_answer']);
            $table->json('options')->nullable();
            $table->string('correct_answer');
            $table->integer('points')->default(1);
            $table->integer('order')->default(0);
            $table->timestamps();
        });
    }
};
