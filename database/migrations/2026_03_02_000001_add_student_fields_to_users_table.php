<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id')->nullable()->unique()->after('email');
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete()->after('type');
            $table->foreignId('year_id')->nullable()->constrained('years')->nullOnDelete()->after('department_id');
            $table->string('phone')->nullable()->change();
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['department_id']);
            $table->dropForeign(['year_id']);
            $table->dropColumn(['google_id', 'department_id', 'year_id']);
            $table->string('phone')->nullable(false)->change();
            $table->string('password')->nullable(false)->change();
        });
    }
};
