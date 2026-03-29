<?php

declare(strict_types=1);

namespace MwAuth;

/**
 * Configuration from environment variables.
 */
final class Config
{
    /** @var array<string, array{host: string, port: int, name: string, user: string, password: string}> */
    public readonly array $databases;
    public readonly string $jwtSecret;
    public readonly int $jwtTtl;
    public readonly string $cookieName;
    public readonly string $cookieDomain;
    public readonly bool $cookieSecure;

    public function __construct()
    {
        $dbUser = self::env('DB_USER', 'root');
        $dbPassword = self::env('DB_PASSWORD', '');

        $this->databases = [
            'classic' => [
                'host' => self::env('CLASSIC_DB_HOST', 'vmangos-db'),
                'port' => (int) self::env('CLASSIC_DB_PORT', '3306'),
                'name' => self::env('CLASSIC_DB_NAME', 'realmd'),
                'user' => self::env('CLASSIC_DB_USER', $dbUser),
                'password' => self::env('CLASSIC_DB_PASSWORD', $dbPassword),
            ],
            'tbc' => [
                'host' => self::env('TBC_DB_HOST', 'cmangos-tbc-db'),
                'port' => (int) self::env('TBC_DB_PORT', '3306'),
                'name' => self::env('TBC_DB_NAME', 'tbcrealmd'),
                'user' => self::env('TBC_DB_USER', $dbUser),
                'password' => self::env('TBC_DB_PASSWORD', $dbPassword),
            ],
            'wotlk' => [
                'host' => self::env('WOTLK_DB_HOST', 'azerothcore-db'),
                'port' => (int) self::env('WOTLK_DB_PORT', '3306'),
                'name' => self::env('WOTLK_DB_NAME', 'acore_auth'),
                'user' => self::env('WOTLK_DB_USER', $dbUser),
                'password' => self::env('WOTLK_DB_PASSWORD', $dbPassword),
            ],
        ];

        $this->jwtSecret = self::env('JWT_SECRET', '');
        if ($this->jwtSecret === '') {
            throw new \RuntimeException('JWT_SECRET environment variable is required');
        }

        $this->jwtTtl = (int) self::env('JWT_TTL', (string) (86400 * 30)); // 30 days
        $this->cookieName = self::env('COOKIE_NAME', 'mw_auth');
        $this->cookieDomain = self::env('COOKIE_DOMAIN', '');
        $this->cookieSecure = self::env('COOKIE_SECURE', '1') === '1';
    }

    private static function env(string $name, string $default): string
    {
        $value = getenv($name);
        return ($value !== false && $value !== '') ? $value : $default;
    }
}
