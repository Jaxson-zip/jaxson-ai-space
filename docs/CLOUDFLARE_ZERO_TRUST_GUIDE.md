# Cloudflare Access 零信任与 Tunnel 生产配置实操指南

本指南将指导你在云服务器上线时，如何在 **5 分钟内** 配置好 Cloudflare 零信任边缘防护，实现：
1. **服务器 0 端口暴露**（关闭云主机全部入站端口）；
2. **私人工作台 `/studio` 邮箱 6 位 PIN 码拦截**（只有你本人的邮箱能登录）。

---

## 🛠️ 第一步：创建 Cloudflare Tunnel（免公网端口暴露）

1. 登录 [Cloudflare Zero Trust 控制台](https://one.dash.cloudflare.com/)；
2. 进入 **Networks ➔ Tunnels**，点击 **Create a tunnel**；
3. 选择 **Cloudflare Managed**，给隧道起个名字（例如 `jaxson-space-tunnel`）；
4. 选择你的云服务器操作系统（例如 `Debian / Ubuntu 64-bit`），复制官方提供的一键安装命令并在云服务器终端执行；
5. 在 **Public Hostname** 中添加路由：
   * **Domain**：选择你的域名（例如 `yourdomain.com`）；
   * **Service Type**：`HTTP`；
   * **URL**：`localhost:80`（指向 Caddy 容器）。

---

## 🔐 第二步：配置 `/studio` 与 `/admin` 邮箱 PIN 码保护策略

1. 在 Cloudflare Zero Trust 控制台，进入 **Access ➔ Applications**；
2. 点击 **Add an application ➔ Self-hosted**；
3. **Application Configuration**：
   * **Application name**：`Jaxson Studio Private Workbench`；
   * **Application domain**：`yourdomain.com`；
   * **Path**：`studio*`（同样可再建一条规则保护 `admin*`）；
4. **Add Policies（安全策略）**：
   * **Policy name**：`Owner Only Access`；
   * **Action**：`Allow`；
   * **Include**：`Emails` ➔ 填入你的个人邮箱（例如 `your-email@example.com`）；
5. 点击 **Save application**。

---

## 🎯 效果验证

* **访客访问**：直接访问 `https://yourdomain.com` 正常浏览前台；
* **访客尝试访问 `/studio`**：直接被 Cloudflare 拦截并弹出官方登录框，要求输入指定邮箱接收验证码；
* **你本人访问 `/studio`**：输入你的邮箱，收到 6 位一次性验证码，输入后直接秒级进入私人工作台！
