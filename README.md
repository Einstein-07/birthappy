# BirtHappy

> 今天，世界为你甜了一点。

BirtHappy 是一个只展示「今天过生日的人」的轻量生日祝福网站。没有评论区，没有排行榜，只有一张今日生日桌、一块蛋糕，以及一份被记住的心意。

作者：绛河

![BirtHappy 首页](docs/screenshots/home-desktop.jpg)

## 已实现功能

- **首页**：只展示今天（北京时间）过生日的注册用户，列表包含头像、公开称呼、非空简介和「送一块蛋糕」按钮。
- **送蛋糕**：登录用户对同一位朋友每年最多送一次，重复请求幂等；不能给自己送；服务端校验今天是否真的是对方生日。
- **「我」页**：编辑头像、称呼、简介、生日，切换匿名展示，实时预览首页上的公开卡片。
- **资料修改额度**：头像、称呼、简介每自然月最多修改 3 次，注册计为当月第 1 次；第 1、2 次修改不提示额度，第 3 次后显示已用完并锁定，直到下月 1 日恢复。匿名开关和生日不占此额度。
- **生日修改额度**：每个账号终身 3 次修改机会，注册不计入。每次修改前必须二次确认，并明确提示将移除已收到的生日祝福、保留已收到的切蛋糕回礼；每次成功后显示剩余次数。
- **匿名**：只影响首页公开称呼，显示为「匿名的朋友」；「我」页仍保留并展示真实称呼。
- **纯黑默认头像**：没有上传头像时显示纯黑圆形；简介为空时首页完全不渲染简介区域。
- **切蛋糕**：一次性回应所有尚未回应的祝福，并给每位祝福者回赠一块蛋糕；回礼会记入对方的「收到祝福」。
- **祝福统计**：总览收到的全部祝福，支持按自然年细分，同时区分生日蛋糕与回礼。
- **邮箱验证码注册**：使用 Resend HTTP API 发送验证码；10 分钟有效、一次性使用、最多尝试 5 次。注册页明确提示发件地址和垃圾邮件风险。
- **邮箱 / UID 登录**：bcrypt 密码哈希、HttpOnly 签名 Cookie、同源校验、参数化 SQL；旧账号可在绑定邮箱前过渡登录。
- **UID**：注册后系统生成 UID，可修改一次；页面显示剩余次数，旧 UID 修改后立即失效。
- **每日注册上限**：北京时间每日最多 100 位；同一网络每日最多 5 位；验证码发送按邮箱、IP、全站限流。
- **基础反爬**：数据库限流、服务端签名表单时间令牌、隐藏蜜罐字段和邮箱归属验证。
- **账号其他功能**：「我 → 其他」提供联系我们、隐私协议和邮箱验证后注销账号；注销会删除全部关联数据并回收 UID。
- **敏感词过滤**：称呼/简介实时预检并禁用提交，后端独立二次校验；覆盖 Unicode 规范化、拼音/数字替代和去符号变体。
- **页脚统计**：小字显示注册用户总数和语义化版本号。
- **视觉与响应式**：奶油白与炭黑配色、中文衬线标题、轻柔动效、移动端适配、键盘焦点与减少动态效果支持。
- **零对象存储**：头像在浏览器端裁切压缩，存入数据库，由专用缓存接口返回。
- **零配置本地开发**：默认使用本地 SQLite 文件，生产切换 Turso 即可。
- **自动建表**：首次请求幂等初始化数据库，无需手工执行 SQL。

![「我」页](docs/screenshots/me-desktop.jpg)

<p>
  <img src="docs/screenshots/home-mobile.jpg" alt="移动端首页" width="330" />
</p>

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 15 App Router + React 19 + TypeScript |
| 样式 | 原生 CSS（`src/app/globals.css`），无 UI 框架 |
| 数据库 | libSQL / SQLite，生产使用 Turso |
| 鉴权 | jose JWT + HttpOnly Cookie，bcryptjs 密码哈希 |
| 邮件 | Resend HTTP API（验证码） |
| 部署 | Netlify 免费额度 + Turso 免费额度 |

## 本地启动

要求 Node.js **20.9 或更高版本**（推荐 22 LTS）。

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。首次访问会自动创建 `data/birthhappy.db`。

### 载入演示数据（可选）

```bash
npm run seed
```

会写入 5 个本地区域演示账号，统一密码为 `birthhappy123`：

| 邮箱 / UID | 角色 |
| --- | --- |
| `xiaoman@example.com` / `XIAOMAN` | 今天生日，有 4 份历史祝福、2 份待回应，可体验切蛋糕 |
| `yuan@example.com` / `YUAN2026` | 今天生日，有头像 |
| `acheng@example.com` / `ACHENG` | 今天生日，匿名、无头像、简介为空，用于验证边界展示 |
| `zhiyao@example.com` / `ZHIYAO` | 非今日生日，可用于给他人送蛋糕 |
| `nan@example.com` / `NANYU` | 非今日生日 |

> 演示邮箱为 `example.com`，不会真正收信；邮箱验证码注册需要在环境中配置 Resend API Key 和已验证的发件地址后才能测试。

> `seed` 默认只会写入 `file:` 本地数据库；若目标是远程数据库，脚本会拒绝执行。请勿把演示数据写入正式环境。

### 环境变量

本地开发不需要环境变量。生产环境参考 [.env.example](.env.example)：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | 生产必填 | Turso 数据库 URL，例如 `libsql://xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | 生产必填 | Turso 数据库访问令牌 |
| `AUTH_SECRET` | 生产必填 | 至少 32 位随机字符串，用于签名登录 Cookie、验证码和表单令牌；缺失时相关逻辑拒绝工作 |
| `AUTH_COOKIE_SECURE` | 否 | 仅供本机用 HTTP 跑生产构建时设为 `false`；线上不要设置 |
| `RESEND_API_KEY` | 生产必填 | Resend API Key，只在服务端环境变量中使用 |
| `RESEND_FROM` | 生产强烈建议 | 已在 Resend 验证域名的发件地址，如 `BirtHappy <noreply@your-domain.com>` |
| `RESEND_REPLY_TO` | 否 | 可选回复地址 |
| `BACKUP_TOKEN` | 可选 | 生产备份下载接口令牌，至少 32 位；不配置时接口返回 404 |

Resend 需要在 Dashboard 中验证域名，并把 `RESEND_FROM` 设置为该域名下的地址；否则免费测试地址 `onboarding@resend.dev` 通常只能发往 Resend 账户自己的邮箱。Resend 免费额度与每日 100 人上限匹配，适合当前规模。

## 常用命令

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建（含类型检查）
npm run start    # 启动已构建的生产服务
npm run seed     # 载入本地演示数据
npm run backup   # 备份数据库到 backups/
npm run restore -- <备份文件.json> --force  # 从备份恢复
```

## 核心规则

- 所有「今天」均按 **Asia/Shanghai（北京时间）** 判断。
- 生日只按「月-日」匹配；年份不公开、不展示年龄。
- 2 月 29 日生日在非闰年的 2 月 28 日展示和庆祝。
- 生日用户本人会从自己的首页列表中排除，避免给自己送蛋糕。
- 同一送礼人对同一收礼人、同一种祝福，每自然年只计一次。
- 切蛋糕可以多次进行：有新祝福时按钮重新可用；没有待回应祝福时禁用。
- 「收到的祝福」= 他人在首页送出的生日蛋糕 + 他人切蛋糕后回赠的蛋糕。
- 资料修改额度按北京时间自然月计算；注册计入当月第 1 次，同一保存即使同时改三项也只计 1 次，无变化保存和匿名切换不计次。
- 修改生日后，收到的全部生日祝福被移除，收到的切蛋糕回礼保留；生日修改共 3 次，服务端强制二次确认。
- 游客可以浏览首页，但送蛋糕、切蛋糕与编辑资料必须登录。
- 注册必须完成邮箱验证码验证并勾选隐私协议；每日最多新增 100 位注册用户。
- 登录使用邮箱或 UID；UID 只允许修改 1 次，修改后旧 UID 立即失效。
- 注销账号必须通过当前邮箱验证码；注销后 UID 回收，所有关联数据删除。
- 称呼/简介命中敏感词时，前端实时警告并禁用提交，后端仍会返回 422 二次拒绝。
- 页脚版权署名：`© 年份 绛河 · BirtHappy`；另以小字显示注册人数和语义化版本。
- 版本规则见 [版本规范](docs/版本规范.md)，当前版本 `v2.0.1`。

完整产品规则与验收条件见 [需求文档](docs/需求文档.md)。

## 维护与备份

长期维护、备份恢复、故障排查和额度说明：

- [维护手册](docs/维护手册.md)
- [用量与容量说明](docs/用量与容量.md)

生产数据库备份：

```powershell
# 先在 .env.local 配置 Turso URL 和 Token，或直接备份本地数据库
npm run backup
```

备份文件默认写入 `backups/`，格式为 `birthappy-backup-v3`，包含用户邮箱、UID、密码哈希、资料、头像、祝福、切蛋糕记录和修改额度。短命的邮箱验证码、注册限流事件和每日计数器不进入备份。该目录已被 `.gitignore` 排除，**不要上传到公开位置**。

如果本地网络无法连接 Turso，可在 Netlify 配置 `BACKUP_TOKEN`，通过受保护的 `/api/admin/backup` 接口从 Netlify 服务器下载生产备份。详细命令见[维护手册](docs/维护手册.md)。

恢复前先在本地测试库演练：

```powershell
$env:TURSO_DATABASE_URL = "file:./data/restore-test.db"
npm run restore -- "backups\你的备份文件.json" --force
```

生产恢复会清空目标库中的现有数据，务必先做新的备份，并确认 `.env.local` 指向正确数据库。

## 目录结构

```text
src/
  app/
    (main)/              # 带主导航的页面：首页、我、隐私协议
    (auth)/              # 登录、注册、绑定邮箱
    api/                 # 注册/登录/验证码/UID/注销/资料/祝福/头像/备份
    globals.css          # 全站视觉与响应式
  components/            # 导航、表单、验证码、UID、其他栏、统计、Toast 等
  lib/                   # 数据库、会话、邮件、验证码、敏感词、校验、数据访问
scripts/
  seed-demo.mjs          # 本地演示数据
  backup-db.mjs          # v3 备份
  restore-db.mjs         # 兼容 v1/v2/v3 恢复
docs/
  需求文档.md
  版本规范.md
  Netlify部署指南.md
  维护手册.md
  用量与容量.md
  screenshots/
CHANGELOG.md
```

## 部署到公网

国内网络优先使用 Netlify，详见 **[Netlify 免费部署指南](docs/Netlify部署指南.md)**。Netlify 新项目默认是 Private，部署成功后还需要在 `Project configuration → General → Visitor access` 把 Production 改成 **Public**，否则匿名访问会返回 401。

简要流程：

1. 将代码推送到 GitHub。
2. 在 [Turso](https://turso.tech) 创建免费数据库，取得 URL 与 Token。
3. 在 [Netlify](https://app.netlify.com) 导入仓库。
4. 配置 `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`、`AUTH_SECRET`、`RESEND_API_KEY`、`RESEND_FROM`；需要生产备份下载时再配置 `BACKUP_TOKEN`。
5. 部署完成后访问 Netlify 域名，检查页脚版本、注册验证码和旧账号迁移。

## 已知边界

当前定位是朋友间的小型生日应用，暂不包含：

- 自助找回密码、修改密码和人工申诉后台。
- 手机号登录、第三方登录、多设备管理。
- 评论、私信、关注、推送通知。
- 内容举报后台与人工审核队列（仅做基础敏感词过滤）。
- 多时区选择（统一按北京时间）。

公开运营前仍建议补充：监控告警、备份异地保存、账号恢复流程和更完整的内容安全策略。Resend 发件域名必须验证；未配置 `RESEND_FROM` 时只能使用测试地址，通常无法给普通用户发信。
