# AWS Production Deployment Guide (EC2 + Docker)

This guide provides a step-by-step walkthrough for deploying your forked Cal.com instance to AWS production using **EC2** and **Docker Compose**.

## 1. Architecture Overview

For a reliable production setup, we recommend the following:

- **Compute**: AWS EC2 Instance (Ubuntu 22.04 LTS).
- **Containerization**: Docker & Docker Compose.
- **Reverse Proxy**: Nginx (for SSL termination and load balancing).
- **SSL**: Let's Encrypt (Certbot).
- **Database/Redis**: Dockerized (Internal) or AWS RDS/ElastiCache (Recommended for high scale).

### Recommended Instance Size
- **Minimum**: `t3.medium` (2 vCPU, 4GB RAM).
- **Optimal**: `t3.large` (2 vCPU, 8GB RAM).
- **Storage**: 20GB+ (gp3).

---

## 2. Infrastructure Prerequisites

### AWS Security Groups
Create or modify a Security Group for your EC2 instance with the following inbound rules:

| Protocol | Port | Source | Description |
| :--- | :--- | :--- | :--- |
| SSH | 22 | Your IP | Admin access |
| HTTP | 80 | 0.0.0.0/0 | For Certbot & Redirection |
| HTTPS | 443 | 0.0.0.0/0 | Public Web Traffic |

---

## 3. Server Setup & Installation

Connect to your EC2 instance via SSH and run the following:

### Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER
newgrp docker
```

### Clone Your Repository
Navigate to your desired deployment directory and clone your fork:
```bash
git clone https://github.com/SwapnilGatha/cal.com.git
cd cal.com
# Checkout your specific fix branch
git checkout api-v2-fix
```

---

## 4. Environment Configuration

### Create Production .env
Use the template we created to set up your secrets:
```bash
cp production.env.example .env
nano .env
```

> [!IMPORTANT]
> **Essential Variables to Update:**
> - `NEXT_PUBLIC_WEBAPP_URL`: Set to `https://your-domain.com`.
> - `WEBAPP_URL`: Set to `https://your-domain.com`.
> - `NEXTAUTH_URL`: Set to `https://your-domain.com`.
> - `DATABASE_URL`: Ensure secrets are strong.
> - `NEXTAUTH_SECRET`: Generate a strong random string.
> - `CALENDSO_ENCRYPTION_KEY`: Generate a strong random string.

---

## 5. Deployment with Docker Compose

We will use the production-optimized file:
```bash
# Start the production stack
docker-compose -f docker-compose.prod.yml up -d
```

### Verify Status
```bash
docker ps
docker-compose logs -f calcom
```

---

## 6. SSL & Reverse Proxy (Nginx)

To handle HTTPS, install Nginx and Certbot on the host machine:

### Install Nginx & Certbot
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Configure Nginx
Create a configuration file `sudo nano /etc/nginx/sites-available/calcom`:
```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable Site and Get SSL
```bash
sudo ln -s /etc/nginx/sites-available/calcom /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d your-domain.com
```

---

## 7. Post-Deployment Logic

### Seeding Your Admin & Sync Script
If this is a fresh database, run your custom scripts once the containers are up:
```bash
# Run migration
docker exec calcom npx prisma migrate deploy

# Run your Shadow User seed (if needed for testing)
DATABASE_URL="postgresql://unicorn_user:magical_password@localhost:5433/calendso" npx ts-node --transpile-only packages/prisma/shadow-user-sync.ts seed-test
```

---

## 8. Maintenance & Updates

- **Updating**: `git pull origin api-v2-fix` then `docker-compose -f docker-compose.prod.yml up -d --build`.
- **Backups**: Use AWS EC2 Snapshotting or `pg_dump` within the container.
- **Monitoring**: Check `docker logs` and Nginx error logs.
