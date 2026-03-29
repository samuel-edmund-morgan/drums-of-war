<?php

declare(strict_types=1);

namespace MwAuth;

/**
 * HTTP route handlers for the auth service.
 */
final class Routes
{
    public function __construct(
        private readonly Config $config,
        private readonly Database $db,
        private readonly Identity $identity,
        private readonly JWT $jwt,
    ) {
    }

    /**
     * POST /auth/login
     * Body: {"username": "...", "password": "...", "patch": "classic|tbc|wotlk"}
     * patch is optional — defaults to trying all patches.
     */
    public function login(): void
    {
        $input = self::jsonInput();
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        $preferredPatch = $input['patch'] ?? null;

        if ($username === '' || $password === '') {
            self::json(400, ['error' => 'Username and password are required']);
            return;
        }

        // Find account across patches
        $patchAccounts = $this->db->findAccountByUsername($username);
        if (empty($patchAccounts)) {
            self::json(401, ['error' => 'Invalid username or password']);
            return;
        }

        // Determine which patch to verify against
        $verifyPatch = null;
        if ($preferredPatch !== null && isset($patchAccounts[$preferredPatch])) {
            $verifyPatch = $preferredPatch;
        } else {
            // Use first available patch
            $verifyPatch = array_key_first($patchAccounts);
        }

        $account = $patchAccounts[$verifyPatch];

        // Verify SRP6
        if (!SRP6::verify($username, $password, (string) $account['s'], (string) $account['v'])) {
            self::json(401, ['error' => 'Invalid username or password']);
            return;
        }

        // Resolve/create identity mapping
        $resolved = $this->identity->resolveIdentity($patchAccounts);

        // Issue JWT
        $token = $this->jwt->issue([
            'sub' => $resolved['identity_uuid'],
            'usr' => strtoupper($username),
            'accounts' => $resolved['accounts'],
        ]);

        // Set cookie
        $this->setAuthCookie($token);

        self::json(200, [
            'status' => 'ok',
            'identity_uuid' => $resolved['identity_uuid'],
            'username' => strtoupper($username),
            'accounts' => $resolved['accounts'],
        ]);
    }

    /**
     * POST /auth/logout
     */
    public function logout(): void
    {
        $this->clearAuthCookie();
        self::json(200, ['status' => 'ok']);
    }

    /**
     * GET /auth/session
     * Returns current session info from JWT cookie.
     */
    public function session(): void
    {
        $claims = $this->getClaimsFromCookie();
        if ($claims === null) {
            self::json(401, ['authenticated' => false]);
            return;
        }

        // Optionally refresh accounts map
        $accounts = $this->identity->getAccountsMap((string) $claims['sub']);
        if (empty($accounts)) {
            $accounts = $claims['accounts'] ?? [];
        }

        self::json(200, [
            'authenticated' => true,
            'identity_uuid' => $claims['sub'],
            'username' => $claims['usr'],
            'accounts' => $accounts,
            'issued_at' => $claims['iat'] ?? null,
            'expires_at' => $claims['exp'] ?? null,
        ]);
    }

    /**
     * POST /auth/password/change
     * Body: {"current_password": "...", "new_password": "..."}
     */
    public function passwordChange(): void
    {
        $claims = $this->getClaimsFromCookie();
        if ($claims === null) {
            self::json(401, ['error' => 'Not authenticated']);
            return;
        }

        $input = self::jsonInput();
        $currentPassword = $input['current_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';

        if ($currentPassword === '' || $newPassword === '') {
            self::json(400, ['error' => 'Current and new passwords are required']);
            return;
        }

        if (strlen($newPassword) < 4) {
            self::json(400, ['error' => 'New password must be at least 4 characters']);
            return;
        }

        $username = (string) $claims['usr'];
        $accounts = $claims['accounts'] ?? [];

        // Verify current password against any available patch
        $verified = false;
        foreach ($accounts as $patch => $accountId) {
            $account = $this->db->findAccountById($patch, (int) $accountId);
            if ($account !== null && SRP6::verify($username, $currentPassword, (string) $account['s'], (string) $account['v'])) {
                $verified = true;
                break;
            }
        }

        if (!$verified) {
            self::json(401, ['error' => 'Current password is incorrect']);
            return;
        }

        // Generate new SRP6 credentials
        [$newSalt, $newVerifier] = SRP6::generateRegistrationData($username, $newPassword);

        // Update across all patches
        $updated = [];
        foreach ($accounts as $patch => $accountId) {
            if ($this->db->updateCredentials($patch, (int) $accountId, $newSalt, $newVerifier)) {
                $updated[] = $patch;
            }
        }

        // Re-issue JWT (refresh token)
        $identityUuid = (string) $claims['sub'];
        $refreshedAccounts = $this->identity->getAccountsMap($identityUuid);
        $token = $this->jwt->issue([
            'sub' => $identityUuid,
            'usr' => $username,
            'accounts' => !empty($refreshedAccounts) ? $refreshedAccounts : $accounts,
        ]);
        $this->setAuthCookie($token);

        self::json(200, [
            'status' => 'ok',
            'updated_patches' => $updated,
        ]);
    }

    /**
     * Handle CORS preflight.
     */
    public function options(): void
    {
        http_response_code(204);
    }

    // --- Cookie helpers ---

    private function setAuthCookie(string $token): void
    {
        $options = [
            'expires' => time() + $this->config->jwtTtl,
            'path' => '/',
            'httponly' => true,
            'secure' => $this->config->cookieSecure,
            'samesite' => 'Lax',
        ];
        if ($this->config->cookieDomain !== '') {
            $options['domain'] = $this->config->cookieDomain;
        }
        setcookie($this->config->cookieName, $token, $options);
    }

    private function clearAuthCookie(): void
    {
        $options = [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => $this->config->cookieSecure,
            'samesite' => 'Lax',
        ];
        if ($this->config->cookieDomain !== '') {
            $options['domain'] = $this->config->cookieDomain;
        }
        setcookie($this->config->cookieName, '', $options);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getClaimsFromCookie(): ?array
    {
        $token = $_COOKIE[$this->config->cookieName] ?? null;
        if ($token === null || $token === '') {
            return null;
        }
        return $this->jwt->verify($token);
    }

    // --- HTTP helpers ---

    /**
     * @return array<string, mixed>
     */
    private static function jsonInput(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param array<string, mixed> $data
     */
    private static function json(int $status, array $data): void
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
