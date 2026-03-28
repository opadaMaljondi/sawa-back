<?php

namespace App\Console\Commands;

use App\Services\YouTubeService;
use Illuminate\Console\Command;

class YouTubeSetupCommand extends Command
{
    protected $signature = 'youtube:setup';

    protected $description = 'Check YouTube OAuth env vars and print the browser URL to create storage/app/youtube-token.json';

    public function handle(): int
    {
        $id = (string) config('youtube.client_id');
        $secret = (string) config('youtube.client_secret');
        $redirect = (string) config('youtube.redirect_uri');

        if ($id === '' || $secret === '' || $redirect === '') {
            $this->error('Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI in .env, then run: php artisan config:clear');

            return self::FAILURE;
        }

        $this->line('Client ID: '.substr($id, 0, 12).'…');
        $this->line('Redirect URI: '.$redirect);
        $this->line('APP_URL: '.config('app.url'));
        $this->newLine();

        $path = storage_path('app/youtube-token.json');
        if (is_file($path)) {
            $this->info('Token file exists: '.$path);
        } else {
            $this->warn('Token file missing: '.$path);
            $this->line('You must open the link below in a browser on this machine (same Laravel app), sign in with the Google account that owns the channel, and approve access.');
        }

        $this->newLine();
        $this->line('Authorization URL:');
        $this->info(YouTubeService::oauthAuthorizeUrl());
        $this->newLine();
        $this->line('Google Cloud: enable YouTube Data API v3 and add this exact redirect URI to the OAuth client:');
        $this->line($redirect);
        $this->newLine();

        return self::SUCCESS;
    }
}
