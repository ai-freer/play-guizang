#!/usr/bin/env bash
#
# 一键部署 play-guizang 到 VPS
#
#   git pull -> docker compose build/up -> 健康检查 -> 外部可达性验证
#
# 用法:
#   ./scripts/deploy.sh            # 拉最新代码并重建部署
#   ./scripts/deploy.sh --no-pull  # 跳过 git pull,只用当前工作区代码重建
#
set -euo pipefail

# 切到仓库根目录(脚本所在目录的上一级),保证在任何 cwd 下都能跑
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE="xiaoxiao-cangshifu"
LOCAL_URL="http://127.0.0.1:8088"
PUBLIC_URL="https://play-guizang.ai-world.live"
DO_PULL=1

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# git 以仓库属主身份运行:root 执行本脚本时,避免在 .git 里写出 root 属主文件,
# 也绕开 "dubious ownership" 报错。属主即当前用户时直接执行。
REPO_OWNER="$(stat -c '%U' "$ROOT_DIR")"
git() {
  if [[ "$(id -un)" == "root" && "$REPO_OWNER" != "root" ]]; then
    sudo -u "$REPO_OWNER" git "$@"
  else
    command git "$@"
  fi
}

# ---------------------------------------------------------------------------
if [[ "$DO_PULL" == 1 ]]; then
  log "拉取最新代码 (git pull --ff-only,以属主 $REPO_OWNER 身份)"
  BEFORE="$(git rev-parse HEAD)"
  git pull --ff-only
  AFTER="$(git rev-parse HEAD)"
  if [[ "$BEFORE" == "$AFTER" ]]; then
    ok "已是最新: $(git log --oneline -1)"
  else
    ok "更新: ${BEFORE:0:7} -> ${AFTER:0:7}  $(git log --oneline -1)"
  fi
else
  log "跳过 git pull (--no-pull),使用当前工作区代码"
fi

# ---------------------------------------------------------------------------
log "构建并启动容器 (docker compose up -d --build)"
docker compose up -d --build

# ---------------------------------------------------------------------------
log "等待容器 healthy"
for i in $(seq 1 30); do
  status="$(docker inspect "$SERVICE" --format '{{.State.Health.Status}}' 2>/dev/null || echo "missing")"
  [[ "$status" == "healthy" ]] && break
  printf '  [%02d/30] health=%s\n' "$i" "$status"
  sleep 2
done
[[ "$status" == "healthy" ]] || die "容器未在 60s 内 healthy (当前: $status),查看日志: docker compose logs $SERVICE"
ok "容器 healthy"

# ---------------------------------------------------------------------------
log "本地回环验证 ($LOCAL_URL)"
code="$(curl -s -o /dev/null -w '%{http_code}' "$LOCAL_URL/healthz")"
[[ "$code" == 200 ]] || die "本地 /healthz 返回 $code"
ok "本地 /healthz -> 200"

# ---------------------------------------------------------------------------
log "外部 HTTPS 验证 ($PUBLIC_URL)"
code="$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL/")"
[[ "$code" == 200 ]] || die "外部首页返回 $code (检查 Caddy: systemctl status caddy)"
ok "外部首页 -> 200"

# 抽查一张 tile 资源
sample="$(ls public/assets/tiles/ 2>/dev/null | grep -E '\.(jpg|png)$' | head -1 || true)"
if [[ -n "$sample" ]]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL/assets/tiles/$sample")"
  [[ "$code" == 200 ]] && ok "抽查资源 $sample -> 200" || printf '\033[1;33m! 抽查资源 %s 返回 %s\033[0m\n' "$sample" "$code"
fi

# ---------------------------------------------------------------------------
printf '\n\033[1;32m🎉 部署完成:\033[0m %s\n' "$PUBLIC_URL/"
