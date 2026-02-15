<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('downloaded_lessons', function (Blueprint $table) {
            $table->string('encrypted_path', 500)->nullable()->after('encryption_key');
        });
        \Illuminate\Support\Facades\DB::statement('ALTER TABLE downloaded_lessons MODIFY device_id BIGINT UNSIGNED NULL');
    }

    public function down()
    {
        Schema::table('downloaded_lessons', function (Blueprint $table) {
            $table->dropColumn('encrypted_path');
        });
        \Illuminate\Support\Facades\DB::statement('ALTER TABLE downloaded_lessons MODIFY device_id BIGINT UNSIGNED NOT NULL');
    }
};
