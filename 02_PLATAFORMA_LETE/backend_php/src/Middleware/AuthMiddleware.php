<?php

namespace App\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthMiddleware {
    public static function handle() {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;

        if (!$authHeader) {
            http_response_code(401);
            echo json_encode(['error' => 'No token provided']);
            exit();
        }

        list($jwt) = sscanf($authHeader, 'Bearer %s');

        if (!$jwt) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token format']);
            exit();
        }

        try {
            $secret = $_ENV['SUPABASE_JWT_SECRET'];
            $decoded = JWT::decode($jwt, new Key($secret, 'HS256'));

            // Inyectar datos del usuario en el contexto global
            $GLOBALS['user'] = [
                'id' => $decoded->sub,
                'role' => $decoded->role ?? null
            ];

        } catch (\Exception $e) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token: ' . $e->getMessage()]);
            exit();
        }
    }
}
