# Roo Code Server Launch Guide

This guide provides multiple ways to launch code-server with the IPC socket enabled for Roo Blessed client connectivity.

## Quick Start Options

### Option 1: Manual Launch Script (Recommended)

```bash
cd roo-blessed
./launch-code-server.sh
```

This script:
- Sets up the IPC socket environment variable
- Cleans up any existing sockets
- Launches code-server with proper configuration
- Provides cleanup on exit

### Option 2: Install as System Service

```bash
cd roo-blessed
./install-service.sh
```

This creates a systemd service that:
- Starts automatically on boot
- Restarts on failure
- Runs with proper user permissions
- Sets up the IPC socket environment

### Option 3: Docker Compose

```bash
cd roo-blessed
docker-compose up -d
```

This runs code-server in a container with:
- IPC socket mounted from host
- Persistent workspace volume
- Automatic restart policy

## Detailed Launch Methods

### Manual Launch Script

The `launch-code-server.sh` script provides the most control:

```bash
# Basic launch
./launch-code-server.sh

# Custom port
CODE_SERVER_PORT=9000 ./launch-code-server.sh

# Custom host (for remote access)
CODE_SERVER_HOST=0.0.0.0 ./launch-code-server.sh

# Custom auth method
CODE_SERVER_AUTH=none ./launch-code-server.sh

# Create systemd service
./launch-code-server.sh --create-service

# Create Docker Compose config
./launch-code-server.sh --create-docker
```

**Features:**
- Automatic socket cleanup
- Environment validation
- Signal handling for clean shutdown
- Colored output and progress indicators

### System Service Installation

The `install-service.sh` script creates a production-ready systemd service:

```bash
# Install the service
./install-service.sh

# Service management
sudo systemctl start roo-code-server
sudo systemctl stop roo-code-server
sudo systemctl restart roo-code-server
sudo systemctl status roo-code-server

# View logs
sudo journalctl -u roo-code-server -f
```

**Service Features:**
- Automatic startup on boot
- Restart on failure
- Proper user permissions
- Security hardening
- Logging to systemd journal

### Docker Deployment

Use Docker Compose for containerized deployment:

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Start with Blessed client container
docker-compose --profile client up -d
```

**Environment Variables:**
```bash
# .env file for Docker Compose
CODE_SERVER_PORT=8080
CODE_SERVER_PASSWORD=your-secure-password
SUDO_PASSWORD=your-sudo-password
```

## Configuration Options

### Environment Variables

All launch methods support these environment variables:

```bash
# IPC Socket (automatically set by scripts)
export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"

# Server Configuration
export CODE_SERVER_PORT=8080
export CODE_SERVER_HOST=0.0.0.0
export CODE_SERVER_AUTH=password

# Docker-specific
export CODE_SERVER_PASSWORD=your-password
export SUDO_PASSWORD=your-sudo-password
```

### Code Server Config

Place configuration in `~/.config/code-server/config.yaml`:

```yaml
bind-addr: 0.0.0.0:8080
auth: password
password: your-secure-password
cert: false
```

## Verification Steps

After launching code-server with any method:

### 1. Check Service Status

```bash
# For manual launch: Check the terminal output
# For systemd: 
sudo systemctl status roo-code-server

# For Docker:
docker-compose ps
```

### 2. Verify IPC Socket

```bash
cd roo-blessed
npm test
```

Expected output:
```
🔍 Testing Roo Code IPC Connection...
📍 Socket path: /tmp/roo-code-ipc.sock
✅ Socket file exists
✅ File is a valid socket
🎉 Connection test passed!
```

### 3. Test Web Interface

Open your browser to:
- Local: `http://localhost:8080`
- Remote: `http://your-server-ip:8080`

### 4. Start Blessed Client

```bash
cd roo-blessed
npm start
```

## Troubleshooting

### Socket Not Created

**Problem:** `npm test` shows "Socket file does not exist"

**Solutions:**
1. Ensure code-server was started with the environment variable
2. Check code-server logs for errors
3. Verify Roo extension is installed and enabled
4. Restart code-server completely (not just reload)

### Permission Issues

**Problem:** Permission denied accessing socket

**Solutions:**
1. Check socket file permissions: `ls -la /tmp/roo-code-ipc.sock`
2. Ensure same user running code-server and blessed client
3. Try different socket location: `~/roo-code-ipc.sock`

### Service Won't Start

**Problem:** Systemd service fails to start

**Solutions:**
1. Check logs: `sudo journalctl -u roo-code-server -n 20`
2. Verify code-server path: `which code-server`
3. Check user permissions and home directory access
4. Validate service file syntax

### Docker Issues

**Problem:** Container won't start or socket not accessible

**Solutions:**
1. Check container logs: `docker-compose logs roo-code-server`
2. Verify volume mounts: `/tmp` should be mounted
3. Check user ID mapping: `user: "1000:1000"`
4. Ensure socket path is consistent between host and container

## Production Deployment

### Security Considerations

1. **Use strong passwords** for code-server authentication
2. **Enable HTTPS** with proper certificates
3. **Restrict network access** using firewall rules
4. **Run as non-root user** (handled by scripts)
5. **Regular updates** of code-server and extensions

### Monitoring

1. **Systemd service** provides automatic restart and logging
2. **Docker health checks** can be added to compose file
3. **Log rotation** is handled by systemd/Docker
4. **Socket monitoring** via blessed client connection tests

### Backup

Important files to backup:
- `~/.config/code-server/` - Configuration
- Workspace directories
- Extension settings
- Custom launch scripts

## Integration Examples

### SSH Tunnel Setup

```bash
# On remote server
./launch-code-server.sh

# On local machine
ssh -L 8080:localhost:8080 user@remote-server

# Access locally at http://localhost:8080
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'roo-code-server',
    script: './launch-code-server.sh',
    env: {
      ROO_CODE_IPC_SOCKET_PATH: '/tmp/roo-code-ipc.sock',
      CODE_SERVER_PORT: 8080
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Choose the launch method that best fits your deployment needs!