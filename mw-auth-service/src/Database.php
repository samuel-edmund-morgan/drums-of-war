<?php

declare(strict_types=1);

namespace MwAuth;

use PDO;
use PDOException;

/**
 * Multi-database connection manager.
 * Connects lazily to classic/tbc/wotlk auth databases.
 */
final class Database
{
    /** @var array<string, PDO> */
    private array $connections = [];

    public function __construct(private readonly Config $config)
    {
    }

    /**
     * Get PDO connection for a specific patch.
     *
     * @param string $patch 'classic', 'tbc', or 'wotlk'
     */
    public function connection(string $patch): PDO
    {
        if (!isset($this->config->databases[$patch])) {
            throw new \InvalidArgumentException("Unknown patch: {$patch}");
        }

        if (!isset($this->connections[$patch])) {
            $db = $this->config->databases[$patch];
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $db['host'], $db['port'], $db['name']);

            $this->connections[$patch] = new PDO($dsn, $db['user'], $db['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }

        return $this->connections[$patch];
    }

    /**
     * Get all configured patch names.
     *
     * @return string[]
     */
    public function patches(): array
    {
        return array_keys($this->config->databases);
    }

    /**
     * Schema mapping per patch.
     * CMaNGOS/VMaNGOS: s, v columns (hex text) — SRP6 uses strrev(salt) internally
     * AzerothCore: salt, verifier columns (binary(32)) = REVERSE(UNHEX(cmangos_hex))
     */
    private const SCHEMA = [
        'classic' => ['salt_col' => 's', 'verifier_col' => 'v', 'format' => 'hex',
                       'select_s' => 's', 'select_v' => 'v'],
        'tbc'     => ['salt_col' => 's', 'verifier_col' => 'v', 'format' => 'hex',
                       'select_s' => 's', 'select_v' => 'v'],
        'wotlk'   => ['salt_col' => 'salt', 'verifier_col' => 'verifier', 'format' => 'binary',
                       'select_s' => 'UPPER(HEX(REVERSE(salt)))', 'select_v' => 'UPPER(HEX(REVERSE(verifier)))'],
    ];

    private function schema(string $patch): array
    {
        return self::SCHEMA[$patch] ?? self::SCHEMA['classic'];
    }

    /**
     * Find account by username across all patches.
     * Returns [patch => account_row, ...] for patches where the account exists.
     * All rows normalized to have 's' and 'v' as uppercase hex strings.
     *
     * @return array<string, array<string, mixed>>
     */
    public function findAccountByUsername(string $username): array
    {
        $results = [];
        $upperUsername = strtoupper($username);

        foreach ($this->patches() as $patch) {
            try {
                $pdo = $this->connection($patch);
                $s = $this->schema($patch);
                $sql = sprintf(
                    'SELECT id, username, %s AS s, %s AS v FROM account WHERE UPPER(username) = ?',
                    $s['select_s'],
                    $s['select_v']
                );
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$upperUsername]);
                $row = $stmt->fetch();
                if ($row !== false) {
                    $results[$patch] = $this->normalizeRow($row, $s['format']);
                }
            } catch (PDOException) {
                // Skip unreachable databases
            }
        }

        return $results;
    }

    /**
     * Find account by ID on a specific patch.
     *
     * @return array<string, mixed>|null
     */
    public function findAccountById(string $patch, int $accountId): ?array
    {
        try {
            $pdo = $this->connection($patch);
            $s = $this->schema($patch);
            $sql = sprintf(
                'SELECT id, username, %s AS s, %s AS v FROM account WHERE id = ?',
                $s['select_s'],
                $s['select_v']
            );
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$accountId]);
            $row = $stmt->fetch();
            return $row !== false ? $this->normalizeRow($row, $s['format']) : null;
        } catch (PDOException) {
            return null;
        }
    }

    /**
     * Update SRP6 credentials for an account on a specific patch.
     * Handles hex text (CMaNGOS/VMaNGOS) vs binary (AzerothCore) formats.
     */
    public function updateCredentials(string $patch, int $accountId, string $saltHex, string $verifierHex): bool
    {
        try {
            $pdo = $this->connection($patch);
            $s = $this->schema($patch);

            if ($s['format'] === 'binary') {
                // AzerothCore stores salt/verifier as REVERSE(UNHEX(cmangos_hex))
                $sql = sprintf(
                    'UPDATE account SET %s = REVERSE(UNHEX(LPAD(?, 64, \'0\'))), %s = REVERSE(UNHEX(LPAD(?, 64, \'0\'))) WHERE id = ?',
                    $s['salt_col'],
                    $s['verifier_col']
                );
            } else {
                $sql = sprintf(
                    'UPDATE account SET %s = ?, %s = ? WHERE id = ?',
                    $s['salt_col'],
                    $s['verifier_col']
                );
            }

            $stmt = $pdo->prepare($sql);
            return $stmt->execute([$saltHex, $verifierHex, $accountId]);
        } catch (PDOException) {
            return false;
        }
    }

    /**
     * Normalize a row so 's' and 'v' are always uppercase hex strings.
     * For AzerothCore, SELECT already does HEX(REVERSE(...)) so values come as hex.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizeRow(array $row, string $format): array
    {
        $row['s'] = strtoupper(trim((string) ($row['s'] ?? '')));
        $row['v'] = strtoupper(trim((string) ($row['v'] ?? '')));
        return $row;
    }
}
