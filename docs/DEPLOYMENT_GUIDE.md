# CHENGETO Health Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 50 GB SSD | 100+ GB SSD |
| Network | 10 Mbps | 100+ Mbps |

### Software Requirements

- Docker 24.0+
- Docker Compose 2.20+
- Node.js 18+ (for manual deployment)
- MongoDB 4.4+ (Compose uses `mongo:4.4`)
- Redis 7.0+

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd <YOUR_REPO_FOLDER>
```

### 2. Create Environment File

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

### 3. Environment Variables

```bash
# Application
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=mongodb://admin:password@mongodb:27017/chengeto_health?authSource=admin
MONGO_PASSWORD=your_secure_mongodb_password

# Redis
REDIS_URL=redis://:password@redis:6379
REDIS_PASSWORD=your_secure_redis_password

# JWT
JWT_SECRET=your_jwt_secret_min_32_characters
JWT_EXPIRE=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRE=30d

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key

# Blockchain
BLOCKCHAIN_RPC_URL=http://blockchain:8545
BLOCKCHAIN_PRIVATE_KEY=your_blockchain_private_key
CONTRACT_ADDRESS=deployed_contract_address

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# CORS
CORS_ORIGIN=https://chengeto.health

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### 4. Generate Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate encryption key (must be exactly 32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## Docker Deployment

### Quick Start

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### Production (Build Images)

This repo includes production Dockerfiles for `backend/` and `frontend/` plus an override compose file:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### PWA / Service Worker Verification

By default the compose stack runs the frontend in dev mode (fast iteration). For an installable PWA experience (service worker + offline app shell) start the production preview frontend instead:

```bash
docker compose stop frontend
docker compose --profile pwa up -d frontend-prod
```

### Production Deployment

```bash
# Use production compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Load Balancer                          │
│                    (nginx/traefik)                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                         │                                    │
│  ┌─────────────────┐    │    ┌─────────────────┐           │
│  │   Frontend      │    │    │    Backend      │            │
│  │   (React PWA)   │◄───┼───►│   (Node.js)     │            │
│  │   Port: 80      │    │    │   Port: 5000    │            │
│  └─────────────────┘    │    └────────┬────────┘           │
│                         │             │                     │
│                         │    ┌────────┴────────┐           │
│                         │    │                 │            │
│                         │    ▼                 ▼            │
│                         │  ┌───────┐     ┌─────────┐       │
│                         │  │ Redis │     │ MongoDB │       │
│                         │  │ :6379 │     │  :27017 │       │
│                         │  └───────┘     └─────────┘       │
│                         │                                    │
│                         │    ┌─────────────────┐           │
│                         │    │   Blockchain    │            │
│                         │    │   (Ganache)     │            │
│                         │    │   Port: 8545    │            │
│                         │    └─────────────────┘           │
│                         │                                    │
└─────────────────────────┴───────────────────────────────────┘
```

### Scaling Services

```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# Use with load balancer for high availability
```

### Health Checks

```bash
# Check backend health
curl http://localhost:5000/health

# Check MongoDB connection
docker-compose exec mongodb mongosh -u admin -p

# Check Redis connection
docker-compose exec redis redis-cli ping
```

---

## Manual Deployment

### Backend Setup

```bash
cd backend

# Install dependencies
npm ci --only=production

# Set environment variables
export NODE_ENV=production
export MONGODB_URI="your_mongodb_uri"
export JWT_SECRET="your_jwt_secret"

# Run database migrations/seed
npm run seed

# Start the server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start src/server.js --name chengeto-backend
pm2 save
pm2 startup
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm ci

# Set environment variables
export VITE_API_URL="https://api.chengeto.health/api/v1"
export VITE_SOCKET_URL="https://api.chengeto.health"

# Build the application
npm run build

# Serve with nginx
sudo cp -r build/* /var/www/chengeto-health/
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/chengeto-health
server {
    listen 80;
    server_name chengeto.health www.chengeto.health;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chengeto.health www.chengeto.health;

    ssl_certificate /etc/letsencrypt/live/chengeto.health/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chengeto.health/privkey.pem;

    # Frontend
    location / {
        root /var/www/chengeto-health;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Proxy
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # MQTT WebSocket Proxy
    location /mqtt/ {
        # Aedes WS broker listens on :8083 and accepts upgrades on any path.
        proxy_pass http://localhost:8083/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Kubernetes Deployment

### Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: chengeto-health
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chengeto-config
  namespace: chengeto-health
data:
  NODE_ENV: "production"
  MQTT_PORT: "1883"
```

### Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: chengeto-secrets
  namespace: chengeto-health
type: Opaque
stringData:
  MONGODB_URI: "mongodb://..."
  JWT_SECRET: "your_jwt_secret"
  ENCRYPTION_KEY: "your_encryption_key"
```

### Backend Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chengeto-backend
  namespace: chengeto-health
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chengeto-backend
  template:
    metadata:
      labels:
        app: chengeto-backend
    spec:
      containers:
      - name: backend
        image: chengeto/backend:latest
        ports:
        - containerPort: 5000
        - containerPort: 1883
        envFrom:
        - configMapRef:
            name: chengeto-config
        - secretRef:
            name: chengeto-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Service

```yaml
# k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: chengeto-backend
  namespace: chengeto-health
spec:
  selector:
    app: chengeto-backend
  ports:
  - name: http
    port: 5000
    targetPort: 5000
  - name: mqtt
    port: 1883
    targetPort: 1883
  type: ClusterIP
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: chengeto-ingress
  namespace: chengeto-health
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - chengeto.health
    - api.chengeto.health
    secretName: chengeto-tls
  rules:
  - host: chengeto.health
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: chengeto-frontend
            port:
              number: 80
  - host: api.chengeto.health
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: chengeto-backend
            port:
              number: 5000
```

### Deploy to Kubernetes

```bash
# Apply all resources
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n chengeto-health

# View logs
kubectl logs -f deployment/chengeto-backend -n chengeto-health
```

---

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d chengeto.health -d www.chengeto.health

# Auto-renewal
sudo certbot renew --dry-run
```

### Self-Signed (Development Only)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privateKey.key \
  -out certificate.crt \
  -subj "/CN=localhost"
```

---

## Monitoring Setup

### Prometheus

```bash
# Access Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n chengeto-health

# Or via Docker
docker-compose up -d prometheus
# Access at http://localhost:9090
```

### Grafana

```bash
# Access Grafana
kubectl port-forward svc/grafana 3000:3000 -n chengeto-health

# Or via Docker
docker-compose --profile monitoring up -d grafana
# Access at http://localhost:3000
# Default credentials: admin / admin
```

### Recommended Dashboards

1. **Node.js Application Dashboard** - Monitor backend performance
2. **MongoDB Dashboard** - Database metrics
3. **Kubernetes Cluster Dashboard** - Infrastructure monitoring

### Alerting Rules

```yaml
# monitoring/alerts.yml
groups:
  - name: chengeto-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected

      - alert: DatabaseDown
        expr: mongodb_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: MongoDB is down
```

---

## Backup and Recovery

### MongoDB Backup

```bash
# Manual backup
docker-compose exec mongodb mongodump \
  --username admin \
  --password $MONGO_PASSWORD \
  --authenticationDatabase admin \
  --db chengeto_health \
  --out /backup/$(date +%Y%m%d)

# Automated backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# MongoDB backup
mongodump --uri="$MONGODB_URI" --out=$BACKUP_DIR/mongodb

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://chengeto-backups/$(date +%Y%m%d_%H%M%S)/
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
# 0 2 * * * /path/to/backup.sh
```

### Restore

```bash
# Restore MongoDB
docker-compose exec mongodb mongorestore \
  --username admin \
  --password $MONGO_PASSWORD \
  --authenticationDatabase admin \
  --db chengeto_health \
  /backup/20240115/chengeto_health
```

### Redis Backup

```bash
# Trigger Redis save
docker-compose exec redis redis-cli BGSAVE

# Copy dump file
docker cp chengeto-redis:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

---

## Troubleshooting

### Common Issues

#### Backend won't start

```bash
# Check logs
docker-compose logs backend

# Common fixes:
# 1. MongoDB not ready - wait or add health check
# 2. Missing environment variables
# 3. Port conflicts
```

#### MongoDB connection errors

```bash
# Check MongoDB status
docker-compose exec mongodb mongosh -u admin -p

# Check connection string
echo $MONGODB_URI

# Check network
docker network ls
docker network inspect chengeto_chengeto-network
```

#### WebSocket connection fails

```bash
# Check nginx configuration
sudo nginx -t

# Check backend logs for socket errors
docker-compose logs backend | grep socket

# Verify CORS settings
```

### Performance Tuning

```bash
# MongoDB indexes
docker-compose exec mongodb mongosh -u admin -p
use chengeto_health
db.patients.getIndexes()
db.patients.createIndex({ "lastName": 1, "firstName": 1 })

# Node.js memory
docker-compose exec backend node -e "console.log(process.memoryUsage())"

# Check container resources
docker stats
```

### Log Aggregation

```bash
# View all logs
docker-compose logs -f

# Export logs
docker-compose logs --no-color > logs_$(date +%Y%m%d).txt

# Use ELK stack for production
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Configure CORS properly
- [ ] Use environment variables for secrets
- [ ] Enable MongoDB authentication
- [ ] Set up VPN for admin access
- [ ] Regular security updates

---

## Support

For deployment support:
- **Email:** devops@chengeto.health
- **Documentation:** https://docs.chengeto.health
- **Status Page:** https://status.chengeto.health
