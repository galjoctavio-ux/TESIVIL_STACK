# =========================================================
# BLOQUE 1: HTTP (Puerto 80)
# Propósito: Manejar excepciones y redirigir todo lo demás a HTTPS + www
# =========================================================
server {
    listen 80;
    server_name tesivil.com www.tesivil.com;

    # EXCEPCIÓN 1: Servir firmware OTA por HTTP
    location /firmware/ {
        ### [MODIFICADO] Nueva ruta en IOT_CORE ###
        alias /home/galj_octavio/TESIVIL_STACK/01_IOT_CORE/firmware/;
        autoindex off;
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
    }

    # EXCEPCIÓN 2: Permitir a Certbot renovar el dominio
    location ~ /.well-known/acme-challenge/ {
        allow all;
        ### [MODIFICADO] Nueva ruta en LANDINGS ###
        root /home/galj_octavio/TESIVIL_STACK/03_LANDINGS/tesivil_static_web;
    }

    # REGLA GENERAL: Redirigir todo lo demás a HTTPS y 'www'
    location / {
        return 301 https://www.tesivil.com$request_uri;
    }
}

# =========================================================
# BLOQUE 2: HTTPS (Puerto 443) - SERVIDOR PRINCIPAL
# Propósito: Servir todo el contenido y las APIs
# =========================================================
server {
    listen 443 ssl;
    server_name tesivil.com www.tesivil.com;

    # --- Configuración SSL ---
    ssl_certificate /etc/letsencrypt/live/tesivil.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tesivil.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # --- Redirección SEO (Forzar 'www') ---
    if ($host = tesivil.com) {
        return 301 https://www.tesivil.com$request_uri;
    }

    # --- Raíz del Frontend Principal (Tesivil Landing Page) ---
    ### [MODIFICADO] Nueva ruta en LANDINGS ###
    root /home/galj_octavio/TESIVIL_STACK/03_LANDINGS/tesivil_static_web;
    index index.html contacto.html;

    # =========================================================
    # --- API Proyecto "Luz en tu Espacio" (LET-E / TESIVIL) ---
    # Peticiones a /lete/api/... van al puerto 3010
    # =========================================================
    location ^~ /lete/api/ {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 🔥 AGREGA ESTO JUSTO DEBAJO 🔥
    # Capturar peticiones que vienen sin el prefijo "/lete" (como la App Técnica)
    location ^~ /api/casos/ {
        # OPCIÓN A: Si tu Node.js espera recibir "/api/casos"
        proxy_pass http://localhost:3010; 
        
        # OPCIÓN B: Si tu Node.js SOLO responde a "/lete/api/casos", usa esta línea en su lugar:
        # rewrite ^/api/casos/(.*) /lete/api/casos/$1 break;
        # proxy_pass http://localhost:3010;

        # Headers obligatorios
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # --- API Módulo Cotizador (PHP) ---
    location ~ ^/api/(cotizacion|cotizar|recursos|xml|admin|ia) {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
    }

    # =========================================================
    # --- Cuentatrón Diagnóstico (Next.js en Puerto 3003) ---
    # =========================================================
    location ^~ /cuentatron/diagnostico {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # =========================================================
    # --- Frontend Panel Admin (Vite Dev Server en 5173) ---
    # =========================================================
    location ^~ /lete/panel/ {
        ### [MODIFICADO] Nueva ruta en PLATAFORMA_LETE ###
        alias /home/galj_octavio/TESIVIL_STACK/02_PLATAFORMA_LETE/panel_admin/dist/;
        try_files $uri $uri/ /lete/panel/index.html;
    }

    # =========================================================
    # --- Frontend PWA Técnico (Producción en /dist) ---
    # =========================================================

    # 1. BLOQUE NUEVO: Atrapa "/lete/app" (sin barra) y fuerza la redirección
    location = /lete/app {
        return 301 $scheme://$http_host/lete/app/;
    }

    # 2. TU BLOQUE ACTUAL: Maneja todo lo que esté DENTRO de "/lete/app/"
    location ^~ /lete/app/ {
        ### [MODIFICADO] Nueva ruta en PLATAFORMA_LETE ###
        alias /home/galj_octavio/TESIVIL_STACK/02_PLATAFORMA_LETE/pwa_tecnico/dist/;
        try_files $uri $uri/ /lete/app/index.html;
    }

    # --- Bloques de Assets Generales ---
    location ^~ /css/ { try_files $uri =404; }
    location ^~ /assets/ { try_files $uri =404; }

    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    # --- Archivos Estáticos de Cuentatrón (Puerto 3000) ---
    location = /admin.html { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
    location = /registro.html { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
    location = /mi-cuenta.html { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
    location = /bienvenido.html { proxy_pass http://localhost:3000; proxy_set_header Host $host; }

    # --- API de Mi Cuenta ---
    location ^~ /api/mi-cuenta {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # --- Assets Cuentatrón ---
    location = /style.css { proxy_pass http://localhost:3000; proxy_set_header Host $host; }

    # --- Redirección Cuentatrón ---
    location = /cuentatron {
        return 301 https://www.tesivil.com/cuentatron/;
    }

    # --- App Principal Cuentatrón (Puerto 3001) ---
    location ^~ /cuentatron/ {
        proxy_pass http://localhost:3001; 
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # --- APIs Varias (Contacto, Admin, Webhooks) ---
    location /api/contacto {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api-cuentatron/ {
        rewrite /api-cuentatron/(.*) /$1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location ^~ /api/admin/get-plans {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ^~ /api/verificar-dispositivo {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ^~ /api/registrar-cliente {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ^~ /api/login {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ^~ /api/cancelar-suscripcion {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ^~ /api/telegram-webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location ^~ /api/chatwoot-webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location = /api.js {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    # --- Assets Proxy Fallback ---
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|pdf)$ {
        try_files $uri @proxy_assets;
    }
    location @proxy_assets {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    location ^~ /api/admin/provision-device {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # --- Supabase & Webhooks Externos ---
    location /auth/v1/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    location = /Instrucciones.pdf { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
    location = /test-pdf { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
    
    location /webhook/stripe {
        proxy_pass http://localhost:3000/webhook/stripe;
        proxy_set_header Host $host;
    }
    location /webhook/mercadopago {
        proxy_pass http://localhost:3000/webhook/mercadopago;
        proxy_set_header Host $host;
    }

    # --- Servicio: Mediciones Python (Mosquitto/Influx) ---
    location /mediciones/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
    }
}
