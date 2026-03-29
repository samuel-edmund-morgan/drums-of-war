<?php

declare(strict_types=1);

namespace MwAuth;

/**
 * Minimal JWT implementation using HMAC-SHA256.
 * No external dependencies — pure PHP.
 */
final class JWT
{
    private string $secret;
    private int $ttlSeconds;

    public function __construct(string $secret, int $ttlSeconds = 86400 * 30)
    {
        if (strlen($secret) < 32) {
            throw new \InvalidArgumentException('JWT secret must be at least 32 characters');
        }
        $this->secret = $secret;
        $this->ttlSeconds = $ttlSeconds;
    }

    /**
     * Issue a signed JWT.
     *
     * @param array<string, mixed> $claims
     */
    public function issue(array $claims): string
    {
        $header = self::base64url(['alg' => 'HS256', 'typ' => 'JWT']);

        $claims['iat'] = time();
        $claims['exp'] = time() + $this->ttlSeconds;

        $payload = self::base64url($claims);

        $signature = self::base64urlRaw(
            hash_hmac('sha256', $header . '.' . $payload, $this->secret, true)
        );

        return $header . '.' . $payload . '.' . $signature;
    }

    /**
     * Verify and decode a JWT. Returns claims array or null if invalid/expired.
     *
     * @return array<string, mixed>|null
     */
    public function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $signature] = $parts;

        // Verify signature
        $expected = self::base64urlRaw(
            hash_hmac('sha256', $header . '.' . $payload, $this->secret, true)
        );

        if (!hash_equals($expected, $signature)) {
            return null;
        }

        // Decode payload
        $claims = json_decode(self::base64urlDecode($payload), true);
        if (!is_array($claims)) {
            return null;
        }

        // Check expiration
        if (isset($claims['exp']) && $claims['exp'] < time()) {
            return null;
        }

        return $claims;
    }

    /**
     * @param array<string, mixed> $data
     */
    private static function base64url(array $data): string
    {
        return self::base64urlRaw(json_encode($data, JSON_UNESCAPED_SLASHES));
    }

    private static function base64urlRaw(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64urlDecode(string $data): string
    {
        $padded = str_pad(strtr($data, '-_', '+/'), (int) (ceil(strlen($data) / 4) * 4), '=');
        return base64_decode($padded, true) ?: '';
    }
}
