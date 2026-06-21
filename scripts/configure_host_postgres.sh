#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# configure_host_postgres.sh
#
# Serverda allaqachon ishlab turgan system PostgreSQL (gennis + turon DB-lar)
# Docker bridge network (172.17.0.0/16) dan ulanishga ruxsat beradi.
#
# Run once as root: bash scripts/configure_host_postgres.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

PG_VERSION=$(psql --version 2>/dev/null | grep -oP '\d+' | head -1)
PG_CONF_DIR="/etc/postgresql/${PG_VERSION}/main"
PG_CONF="${PG_CONF_DIR}/postgresql.conf"
PG_HBA="${PG_CONF_DIR}/pg_hba.conf"

echo "=== PostgreSQL $PG_VERSION topildi ==="
echo "    Config: $PG_CONF"
echo "    HBA:    $PG_HBA"

# ── 1. Listen addresses ───────────────────────────────────────────────────────
# Add Docker bridge IP to listen_addresses (keep localhost too)
if grep -q "^listen_addresses" "$PG_CONF"; then
  # Already set — check if it needs updating
  CURRENT=$(grep "^listen_addresses" "$PG_CONF")
  echo "Current: $CURRENT"
  sed -i "s/^listen_addresses.*/listen_addresses = 'localhost,172.17.0.1'/" "$PG_CONF"
else
  echo "listen_addresses = 'localhost,172.17.0.1'" >> "$PG_CONF"
fi
echo "✓ listen_addresses updated"

# ── 2. pg_hba.conf — allow Docker bridge (172.17.0.0/16) ────────────────────
DOCKER_RULE="host    all             postgres        172.17.0.0/16           md5"

if ! grep -qF "172.17.0.0/16" "$PG_HBA"; then
  echo "" >> "$PG_HBA"
  echo "# Docker bridge network — management_v2 containers" >> "$PG_HBA"
  echo "$DOCKER_RULE" >> "$PG_HBA"
  echo "✓ pg_hba.conf rule added for 172.17.0.0/16"
else
  echo "✓ pg_hba.conf rule already exists"
fi

# ── 3. Restart PostgreSQL ─────────────────────────────────────────────────────
echo ""
echo "=== Restarting PostgreSQL ==="
systemctl restart postgresql
echo "✓ PostgreSQL restarted"

# ── 4. Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "=== Listening addresses ==="
ss -tlnp | grep 5432 || netstat -tlnp | grep 5432

echo ""
echo "✅ Done! PostgreSQL now accepts connections from Docker bridge (172.17.0.0/16)"
echo ""
echo "Test from a container:"
echo "  docker run --rm --add-host host.docker.internal:host-gateway postgres:15-alpine \\"
echo "    psql -h host.docker.internal -U postgres -d gennis -c '\\l'"
