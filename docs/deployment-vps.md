# 《消消藏师傅》VPS 部署说明

## 部署形态

这是一个纯前端 Vite/Phaser 游戏。生产部署流程是：

1. Docker build 阶段运行 `npm run build`，生成 `dist/`。
2. Docker runtime 阶段用 Nginx 托管静态文件。
3. VPS 上用宿主机 Nginx/Caddy 做 HTTPS 和二级域名反向代理。

游戏进度仍保存在玩家浏览器 cookie 中，不需要数据库、账号或后端服务。

## 本地构建验证

```bash
docker compose -p play-guizang build
docker compose -p play-guizang up -d
curl http://127.0.0.1:8088/healthz
```

访问：

```text
http://127.0.0.1:8088/
```

停止：

```bash
docker compose -p play-guizang down
```

## VPS 部署步骤

在 VPS 上安装 Docker 和 Docker Compose plugin 后：

```bash
git clone <your-repo-url> xiaoxiao-cangshifu
cd xiaoxiao-cangshifu
docker compose -p play-guizang up -d --build
```

默认容器只监听宿主机本地端口：

```text
127.0.0.1:8088 -> container:80
```

这样公网不会直接暴露容器端口，外部访问由宿主机反向代理负责。

## 二级域名 DNS

本项目建议使用：

```text
play-guizang.ai-world.live
```

在域名 DNS 控制台添加：

```text
Type: A
Host: play-guizang
Value: <你的 VPS IPv4>
TTL: Auto
```

如果 VPS 有 IPv6，也可以额外添加 AAAA 记录。

## Caddy 反向代理示例

Caddy 会自动申请和续期 HTTPS 证书：

```caddyfile
play-guizang.ai-world.live {
  reverse_proxy 127.0.0.1:8088
}
```

重载：

```bash
sudo caddy reload
```

## 宿主机 Nginx 反向代理示例

```nginx
server {
  listen 80;
  server_name play-guizang.ai-world.live;

  location / {
    proxy_pass http://127.0.0.1:8088;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

使用 Certbot 配 HTTPS：

```bash
sudo certbot --nginx -d play-guizang.ai-world.live
```

## 更新版本

```bash
git pull
docker compose -p play-guizang up -d --build
docker image prune -f
```

## 常用检查

```bash
docker compose -p play-guizang ps
docker compose -p play-guizang logs -f
curl -I http://127.0.0.1:8088/
curl http://127.0.0.1:8088/healthz
```

## 注意事项

- `index.html` 不建议直接用 `file://` 打开，生产环境应通过 HTTP/HTTPS 服务访问。
- 当前路径配置适合部署在二级域名根路径，例如 `https://play-guizang.ai-world.live/`。
- 如果未来要部署到子路径，例如 `https://example.com/game/`，需要额外配置 Vite `base` 和 Nginx 路由。
- `xxcs_progress` cookie 是按当前域名保存的；更换二级域名后，玩家进度不会从旧域名自动迁移。
