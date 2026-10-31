# BirtHappy Netlify 免费部署指南

如果你的网络无法访问 Vercel，或者主要访问者在中国大陆，建议使用 Netlify。项目已经做了 Netlify 适配：

- `netlify.toml` 指定 Node.js 22。
- 远程数据库改用 `@libsql/client/web`（纯 HTTP），不依赖本地 SQLite 原生模块。
- 本地开发仍默认使用 `data/birthhappy.db`，不受影响。

Netlify 的 Next.js Runtime 基于 OpenNext，官方支持 App Router、SSR、Route Handlers 和 Cookie 会话：

- [Next.js on Netlify 官方文档](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify 定价](https://www.netlify.com/pricing/)

> 部署完成后地址形如 `https://birthappy.netlify.app`。`*.netlify.app` 在国内的可达性通常优于 `*.vercel.app`，但仍可能因地区网络变化。

## 1. 前置准备

你需要：

1. GitHub 仓库：`https://github.com/Einstein-07/birthappy`
2. 已创建好的 Turso 数据库：
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. 一个全新的 `AUTH_SECRET`。
4. Netlify 账号，使用 GitHub 登录。

### 如果 Turso Token 丢失

登录 [Turso Dashboard](https://turso.tech/app)，进入 `birthappy` 数据库，重新创建一个 Token。旧 Token 可以继续使用，也可以失效。

### 生成 AUTH_SECRET

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

复制输出，不要提交到 Git。

## 2. 确认 GitHub 代码已更新

本项目的 Netlify 兼容提交应当已经在 `main` 分支。确认 GitHub 仓库根目录能看到：

```text
netlify.toml
```

以及 `src/lib/db.ts` 中使用 `@libsql/client/web` 的远程分支。

## 3. 在 Netlify 导入项目

1. 打开 <https://app.netlify.com/signup>，选择 **Sign up with GitHub**。
2. 登录后进入 <https://app.netlify.com>。
3. 点击 **Add new site** → **Import an existing project**。
4. 选择 **GitHub**。
5. 如果看不到仓库，点击 **Configure the Netlify app on GitHub**，授权访问 `birthappy` 仓库。
6. 选择 `Einstein-07/birthappy`。
7. 分支选择 `main`。
8. 构建设置一般会自动识别：
   - Base directory：留空
   - Build command：`npm run build`
   - Publish directory：`.next` 或自动识别
9. 点击 **Deploy site**。

第一次部署可能因为还没配置环境变量而在运行页面时报错，这是正常的；配置完环境变量后重新部署即可。

## 4. 添加环境变量

进入刚创建站点的：

```text
Site configuration → Environment variables → Add a variable
```

逐个添加：

| 变量名 | 值 | Scope |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | `libsql://...turso.io` | All |
| `TURSO_AUTH_TOKEN` | Turso Token | All |
| `AUTH_SECRET` | 新生成的随机字符串 | All |

说明：

- Scope 建议选 **All**（Builds、Functions、Runtime 都要能读到）。
- 值不要加引号。
- **不要**设置 `AUTH_COOKIE_SECURE=false`。Netlify 默认 HTTPS，Cookie 会自动使用 Secure。
- `NODE_VERSION=22` 已经写在 `netlify.toml`，一般无需额外添加。

## 5. 重新部署

添加环境变量后：

```text
Deploys → Trigger deploy → Deploy site
```

等待构建完成。部署日志中出现类似下面的内容说明成功：

```text
Build script success
Site is live
```

打开 Netlify 给出的地址，例如：

```text
https://birthappy.netlify.app
```

## 6. 修改站点名（推荐）

Netlify 默认会生成随机名称。可以改成更好记的名字：

```text
Site configuration → Site details → Change site name
```

填：

```text
birthappy
```

如果名字已被占用，换成：

```text
birthappy-einstein
```

保存后地址会变为：

```text
https://birthappy.netlify.app
```

## 7. 上线验收

生产数据库和 Vercel 共用同一个 Turso 库，如果你之前在 Vercel 注册过用户，Netlify 上也会看到。

按顺序检查：

1. 首页能正常打开，不再长时间转圈。
2. 点击「写下我的生日」，注册一个今天生日的用户。
3. 首页应该展示该用户。
4. 用第二个账号送蛋糕。
5. 「我」页点击「切蛋糕」，确认回礼和统计更新。
6. 上传头像、切换匿名、保存简介，刷新确认持久化。

> 所有“今天”按北京时间（Asia/Shanghai）判断。测试用户的生日需要填部署当天。

## 8. 常见问题

### 页面 500 或注册失败

检查 Netlify 环境变量：

- 三个变量是否都存在
- Scope 是否包含 **Functions / Runtime**，建议全选 All
- `TURSO_DATABASE_URL` 是否以 `libsql://` 开头
- Turso Token 是否有效

修改后必须重新部署。

### 构建失败：找不到 Node 版本 / Next.js

检查 Netlify 构建日志。项目根目录的 `netlify.toml` 已设置：

```toml
[build.environment]
  NODE_VERSION = "22"
```

如果 Netlify 仍使用旧版本，在环境变量中添加：

```text
NODE_VERSION=22
```

然后重新部署。

### 登录后刷新又退出

- 使用 HTTPS 地址。
- 不要设置 `AUTH_COOKIE_SECURE=false`。
- 确认 `AUTH_SECRET` 没有在部署之间被改来改去。

### 头像 404

未上传头像的用户，`/api/avatar/...` 返回 404 是正常行为，前端会显示纯黑圆形。

### Netlify 地址也无法访问

这说明你的网络对 `netlify.app` 也有限制。下一步可以考虑腾讯 EdgeOne Pages，它提供国内节点和免费套餐，但需要腾讯云账号及少量适配。

## 9. 更新上线

```powershell
cd "D:\Daily\AI-projects\BirtHappy"
git add .
git commit -m "update: 修改说明"
git push
```

Netlify 会自动监听 `main` 分支并重新部署。

## 10. Vercel 项目怎么处理

- 可以保留，作为备用地址。
- 两个平台共用同一个 Turso 数据库，数据不会分叉。
- 如果不想保留 Vercel，可在 Vercel 项目设置中删除项目；删除前确认 Turso 数据库不要删除。
- 域名/链接以后统一使用 Netlify 地址即可。
