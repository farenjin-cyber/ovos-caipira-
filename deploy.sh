#!/bin/bash
# deploy.sh - R1∞ Automated Deployment

echo "🚀 R1∞ DEPLOYMENT STARTED - OVOS CAIPIRA E-COMMERCE"

# Configurações
ENV=${1:-production}
BRANCH=${2:-main}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/ovos_$TIMESTAMP"

# 1. Backup atual
echo "📦 Criando backup..."
mkdir -p $BACKUP_DIR
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_backup.sql
tar -czf $BACKUP_DIR/app_backup.tar.gz /var/www/ovoscaipira

# 2. Pull código
echo "⬇️  Atualizando código..."
cd /var/www/ovoscaipira
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# 3. Instalar dependências
echo "📦 Instalando dependências..."
composer install --no-dev --optimize-autoloader
npm ci --only=production
npm run build

# 4. Migrações e otimizações
echo "🔄 Rodando migrações..."
php artisan migrate --force
php artisan cache:clear
php artisan view:clear
php artisan route:cache
php artisan config:cache

# 5. Reiniciar serviços
echo "🔄 Reiniciando serviços..."
systemctl restart php8.1-fpm
systemctl restart nginx
systemctl restart supervisor

# 6. Health check
echo "🏥 Health check..."
sleep 10
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://ovoscaipira.com.br/health)
if [ $HTTP_STATUS -eq 200 ]; then
    echo "✅ DEPLOY SUCESSO - Sistema online"
    
    # Notificação
    curl -X POST https://api.telegram.org/bot$TELEGRAM_BOT/sendMessage \
        -d "chat_id=$TELEGRAM_CHAT" \
        -d "text=🚀 Deploy concluído - Ovos Caipira $ENV"
else
    echo "❌ DEPLOY FALHOU - Status: $HTTP_STATUS"
    
    # Rollback automático
    echo "🔄 Executando rollback..."
    tar -xzf $BACKUP_DIR/app_backup.tar.gz -C /
    mysql -u $DB_USER -p$DB_PASS $DB_NAME < $BACKUP_DIR/db_backup.sql
    systemctl restart php8.1-fpm
    systemctl restart nginx
    
    exit 1
fi

# 7. Limpeza
echo "🧹 Limpando backups antigos..."
find /backups -type f -mtime +7 -delete

echo "🎉 DEPLOYMENT COMPLETED - R1∞ SYSTEM ACTIVE"