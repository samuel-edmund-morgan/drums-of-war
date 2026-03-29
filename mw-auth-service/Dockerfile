FROM php:8.3-fpm-alpine AS base

# Install GMP extension (required for SRP6) and PDO MySQL
RUN apk add --no-cache gmp-dev nginx \
    && docker-php-ext-install gmp pdo_mysql

# Copy nginx config
COPY nginx/default.conf /etc/nginx/http.d/default.conf

# Configure nginx to run as www-data (non-root)
RUN sed -i 's/^user nginx;/user www-data;/' /etc/nginx/nginx.conf \
    && sed -i 's|/var/log/nginx/error.log|/dev/stderr|' /etc/nginx/nginx.conf \
    && sed -i 's|/var/log/nginx/access.log|/dev/stdout|' /etc/nginx/nginx.conf

# Copy application
COPY public/ /var/www/public/
COPY src/ /var/www/src/

# Create nginx runtime directories and set permissions
RUN mkdir -p /var/lib/nginx/tmp/client_body \
             /var/lib/nginx/tmp/proxy \
             /var/lib/nginx/tmp/fastcgi \
             /var/lib/nginx/tmp/uwsgi \
             /var/lib/nginx/tmp/scgi \
             /var/lib/nginx/logs \
             /run/nginx \
    && chown -R www-data:www-data /var/www /var/lib/nginx /run/nginx /var/log/nginx \
    && touch /run/nginx/nginx.pid \
    && chown www-data:www-data /run/nginx/nginx.pid

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
