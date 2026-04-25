<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->date('expires_at')->nullable()->after('active');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->decimal('renewal_discount', 10, 2)->default(0)->after('referral_discount');
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn('renewal_discount');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });
    }
};
