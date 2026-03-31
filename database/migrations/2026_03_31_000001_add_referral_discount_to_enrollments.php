<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('enrollments', 'referral_discount')) {
            return;
        }
        Schema::table('enrollments', function (Blueprint $table) {
            $table->decimal('referral_discount', 10, 2)->default(0)->after('discount');
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn('referral_discount');
        });
    }
};
