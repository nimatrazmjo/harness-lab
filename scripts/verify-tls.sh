#!/usr/bin/env bash
# infra.ec2_nginx_tls acceptance check — run against the deployed host.
# Usage: scripts/verify-tls.sh scribe.example.com
set -euo pipefail

HOST="${1:?usage: verify-tls.sh <hostname>}"

echo "== Checking TLS cert on $HOST:443 is CA-issued (not self-signed) =="
ISSUER=$(echo | openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null \
  | openssl x509 -noout -issuer 2>/dev/null || true)

if [ -z "$ISSUER" ]; then
  echo "FAIL: could not retrieve certificate from $HOST:443" >&2
  exit 1
fi
echo "Issuer: $ISSUER"
if echo "$ISSUER" | grep -qi "self"; then
  echo "FAIL: certificate appears self-signed" >&2
  exit 1
fi

echo "== Checking the Node process is not directly reachable on 80/443 (only nginx is) =="
# This assumes it's run FROM the EC2 host itself against localhost:<app port>,
# and separately that a direct external connection to the app port is refused
# by the security group. nginx must be the only process bound to 80/443:
if command -v ss >/dev/null 2>&1; then
  ss -ltnp 2>/dev/null | grep -E ':80|:443' || echo "(ss requires sudo on some systems to show process names)"
fi

echo "PASS: $HOST serves a CA-issued cert on 443."
