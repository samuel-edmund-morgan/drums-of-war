<?php

declare(strict_types=1);

// Auto-register class loading from src/
spl_autoload_register(function (string $class): void {
    $prefix = 'MwAuth\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = __DIR__ . '/../src/' . str_replace('\\', '/', $relative) . '.php';
    if (file_exists($file)) {
        require $file;
    }
});

use MwAuth\Config;
use MwAuth\Database;
use MwAuth\Identity;
use MwAuth\JWT;
use MwAuth\Routes;

// CORS headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . (getenv('CORS_ORIGIN') ?: '*'));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Parse request
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH);

// Strip /auth prefix if present (traefik routes /auth/* here)
$path = preg_replace('#^/auth#', '', $path) ?: '/';

// Handle OPTIONS (CORS preflight)
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $config = new Config();
    $db = new Database($config);
    $identity = new Identity($db);
    $jwt = new JWT($config->jwtSecret, $config->jwtTtl);
    $routes = new Routes($config, $db, $identity, $jwt);

    // Ensure identity tables exist on first request (idempotent)
    static $tablesChecked = false;
    if (!$tablesChecked) {
        foreach ($db->patches() as $patch) {
            try {
                $identity->ensureTable($patch);
            } catch (\Throwable) {
                // Non-fatal: table might already exist or DB unreachable
            }
        }
        $tablesChecked = true;
    }

    match (true) {
        $method === 'POST' && $path === '/login' => $routes->login(),
        $method === 'POST' && $path === '/logout' => $routes->logout(),
        $method === 'GET' && $path === '/session' => $routes->session(),
        $method === 'POST' && $path === '/password/change' => $routes->passwordChange(),
        $path === '/health' => (function () {
            echo json_encode(['status' => 'ok', 'service' => 'mw-auth-service']);
        })(),
        default => (function () {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
        })(),
    };
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => getenv('APP_DEBUG') ? $e->getMessage() : 'An unexpected error occurred',
    ]);
}
