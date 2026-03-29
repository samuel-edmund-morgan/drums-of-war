<?php

declare(strict_types=1);

namespace MwAuth;

/**
 * Website identity mapping.
 * Links one identity_uuid to patch-local account IDs.
 */
final class Identity
{
    public function __construct(
        private readonly Database $db,
    ) {
    }

    /**
     * Ensure the website_identity table exists on a given patch.
     */
    public function ensureTable(string $patch): void
    {
        $pdo = $this->db->connection($patch);
        $pdo->exec(<<<'SQL'
            CREATE TABLE IF NOT EXISTS website_identity (
                identity_uuid CHAR(36) NOT NULL PRIMARY KEY,
                account_id INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE INDEX idx_wi_account (account_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        SQL);
    }

    /**
     * Get identity UUID for a given account on a patch.
     */
    public function getIdentityForAccount(string $patch, int $accountId): ?string
    {
        $pdo = $this->db->connection($patch);
        $stmt = $pdo->prepare('SELECT identity_uuid FROM website_identity WHERE account_id = ?');
        $stmt->execute([$accountId]);
        $row = $stmt->fetch();
        return $row !== false ? (string) $row['identity_uuid'] : null;
    }

    /**
     * Get account ID for a given identity UUID on a patch.
     */
    public function getAccountForIdentity(string $patch, string $identityUuid): ?int
    {
        $pdo = $this->db->connection($patch);
        $stmt = $pdo->prepare('SELECT account_id FROM website_identity WHERE identity_uuid = ?');
        $stmt->execute([$identityUuid]);
        $row = $stmt->fetch();
        return $row !== false ? (int) $row['account_id'] : null;
    }

    /**
     * Create or find identity mapping for accounts found by username across patches.
     * Uses the first existing identity_uuid found, or generates a new one.
     *
     * @param array<string, array<string, mixed>> $patchAccounts [patch => account_row]
     * @return array{identity_uuid: string, accounts: array<string, int>}
     */
    public function resolveIdentity(array $patchAccounts): array
    {
        $identityUuid = null;
        $accounts = [];

        // First pass: find existing identity
        foreach ($patchAccounts as $patch => $account) {
            $accountId = (int) $account['id'];
            $accounts[$patch] = $accountId;

            if ($identityUuid === null) {
                $existing = $this->getIdentityForAccount($patch, $accountId);
                if ($existing !== null) {
                    $identityUuid = $existing;
                }
            }
        }

        // Generate new UUID if none found
        if ($identityUuid === null) {
            $identityUuid = self::generateUuid();
        }

        // Second pass: ensure mapping exists on all patches
        foreach ($accounts as $patch => $accountId) {
            $existing = $this->getIdentityForAccount($patch, $accountId);
            if ($existing === null) {
                $pdo = $this->db->connection($patch);
                $stmt = $pdo->prepare(
                    'INSERT IGNORE INTO website_identity (identity_uuid, account_id, created_at) VALUES (?, ?, NOW())'
                );
                $stmt->execute([$identityUuid, $accountId]);
            }
        }

        return [
            'identity_uuid' => $identityUuid,
            'accounts' => $accounts,
        ];
    }

    /**
     * Build the accounts map for JWT claims from an identity UUID.
     *
     * @return array<string, int>
     */
    public function getAccountsMap(string $identityUuid): array
    {
        $accounts = [];
        foreach ($this->db->patches() as $patch) {
            $accountId = $this->getAccountForIdentity($patch, $identityUuid);
            if ($accountId !== null) {
                $accounts[$patch] = $accountId;
            }
        }
        return $accounts;
    }

    private static function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40); // version 4
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80); // variant
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
