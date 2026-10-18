#!/usr/bin/env bash
# gz 的发布脚本：本机构建，上传到 gz 的 /opt/admin-front/releases/<时间>，切换 current 软链，更新 nginx 站点并重载。
# 保留最近 5 个版本；回滚：ssh gz 'cd /opt/admin-front && ln -sfn releases/<版本> current.tmp && mv -Tf current.tmp current'
# 用法：deploy/servers/gz/deploy.sh
set -euo pipefail

HOST=gz
RELEASE="$(date +%Y%m%d-%H%M%S)"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/../../.."

pnpm build:antd
DIST=apps/web-antd/dist

ssh "$HOST" "mkdir -p /opt/admin-front/releases/$RELEASE"
rsync -az --delete "$DIST"/ "$HOST":/opt/admin-front/releases/"$RELEASE"/
rsync -az "$HERE/nginx.conf" "$HOST":/etc/nginx/sites-available/admin-front
ssh "$HOST" "set -e
cd /opt/admin-front
ln -sfn releases/$RELEASE current.tmp && mv -Tf current.tmp current
ln -sfn /etc/nginx/sites-available/admin-front /etc/nginx/sites-enabled/admin-front
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ls -1t releases | tail -n +6 | xargs -r -I{} rm -rf releases/{}
echo \"current -> \$(readlink current)\""
