<?php

namespace App\Http\Controllers;

use Google\Client as GoogleClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class YouTubeAuthController extends Controller
{
    /**
     * Redirect to Google OAuth to authorize YouTube uploads.
     * Visit this URL in the browser: http://localhost:8000/youtube/auth
     */
    public function redirectToGoogle(Request $request)
    {
        $client = new GoogleClient();
        $client->setClientId(config('youtube.client_id'));
        $client->setClientSecret(config('youtube.client_secret'));
        $client->setRedirectUri(config('youtube.redirect_uri'));
        $client->setScopes(config('youtube.scopes'));
        $client->setAccessType('offline');
        $client->setPrompt('consent'); // force refresh token

        $authUrl = $client->createAuthUrl();

        return redirect()->away($authUrl);
    }

    /**
     * Google redirects here after user authorizes. We exchange code for token and save it.
     */
    public function handleCallback(Request $request)
    {
        if (!$request->has('code')) {
            return response()->view('youtube-auth-error', [
                'error' => $request->get('error', 'No authorization code received.'),
            ], 400);
        }

        $client = new GoogleClient();
        $client->setClientId(config('youtube.client_id'));
        $client->setClientSecret(config('youtube.client_secret'));
        $client->setRedirectUri(config('youtube.redirect_uri'));

        try {
            $token = $client->fetchAccessTokenWithAuthCode($request->code);

            if (isset($token['error'])) {
                Log::error('YouTube OAuth error: ' . json_encode($token));
                return response()->view('youtube-auth-error', [
                    'error' => $token['error_description'] ?? $token['error'],
                ], 400);
            }

            $path = storage_path('app/youtube-token.json');
            $dir = dirname($path);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            file_put_contents($path, json_encode($token));

            return response()->view('youtube-auth-success');
        } catch (\Throwable $e) {
            Log::error('YouTube OAuth exception: ' . $e->getMessage());
            return response()->view('youtube-auth-error', ['error' => $e->getMessage()], 500);
        }
    }
}
