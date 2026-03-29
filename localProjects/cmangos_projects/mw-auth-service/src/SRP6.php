<?php

declare(strict_types=1);

namespace MwAuth;

/**
 * SRP6 authentication for WoW private servers.
 * Ported from mangos-website/core/common.php (calculateSRP6Verifier, verifySRP6, getRegistrationData).
 * Supports CMaNGOS, VMaNGOS, and AzerothCore SRP6 format.
 */
final class SRP6
{
    private const GENERATOR = '7';
    private const PRIME_HEX = '894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7';

    /**
     * Calculate SRP6 verifier from username, password, and salt (raw bytes).
     */
    public static function calculateVerifier(string $username, string $password, string $salt): string
    {
        $g = gmp_init(self::GENERATOR);
        $N = gmp_init(self::PRIME_HEX, 16);

        // First hash: SHA1(upper(USERNAME:PASSWORD))
        $h1 = sha1(strtoupper($username . ':' . $password), true);

        // Second hash: SHA1(reverse(salt) . h1)
        $h2 = sha1(strrev($salt) . $h1, true);

        // Convert to integer (little-endian)
        $h2 = gmp_import($h2, 1, GMP_LSW_FIRST);

        // g^h2 mod N
        $verifier = gmp_powm($g, $h2, $N);

        // Convert back to byte array (little-endian)
        $verifier = gmp_export($verifier, 1, GMP_LSW_FIRST);

        // Pad to 32 bytes (zeros at the end for little-endian)
        $verifier = str_pad($verifier, 32, chr(0), STR_PAD_RIGHT);

        // Return reversed (big-endian hex storage format)
        return strrev($verifier);
    }

    /**
     * Verify a password against stored salt and verifier (both as hex strings).
     */
    public static function verify(string $username, string $password, string $saltHex, string $verifierHex): bool
    {
        $computed = self::calculateVerifier($username, $password, hex2bin($saltHex));
        $computedHex = strtoupper(bin2hex($computed));
        return hash_equals(strtoupper($verifierHex), $computedHex);
    }

    /**
     * Generate new salt and verifier for registration or password change.
     * Returns [salt_hex, verifier_hex].
     *
     * @return array{0: string, 1: string}
     */
    public static function generateRegistrationData(string $username, string $password): array
    {
        $salt = random_bytes(32);
        $verifier = self::calculateVerifier($username, $password, $salt);

        return [
            strtoupper(bin2hex($salt)),
            strtoupper(bin2hex($verifier)),
        ];
    }
}
