import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "隐私协议",
  description: "BirtHappy 如何收集、使用、保存和保护你的个人信息。"
};

export default function PrivacyPage() {
  return (
    <div className="legal-page shell">
      <div className="legal-card">
        <Link className="quiet-link legal-back" href="/register">
          返回注册
        </Link>
        <p className="eyebrow">PRIVACY · v2.0.0</p>
        <h1>隐私协议</h1>
        <p className="legal-meta">生效日期：2026 年 11 月 1 日</p>

        <div className="legal-content">
          <p>
            BirtHappy（以下简称“本站”）是一个只展示今天过生日的人、用蛋糕送出祝福的小型网站。
            我们尽量少收集信息，也只把这些信息用于让生日被记住。使用本站前，请阅读下面的说明；
            如果你不同意，请不要注册或使用本站。
          </p>

          <h2>1. 我们收集哪些信息</h2>
          <ul>
            <li>
              <strong>账号信息：</strong>邮箱地址、密码哈希（不保存明文密码）、系统生成的 UID。
            </li>
            <li>
              <strong>个人资料：</strong>你填写的称呼、简介、头像、生日和匿名开关。
              生日中的年份只用于校验日期，不会公开展示，也不展示年龄。
            </li>
            <li>
              <strong>互动记录：</strong>送出的蛋糕、收到的生日祝福、切蛋糕回礼、切蛋糕次数、
              修改资料和生日的时间与额度记录。
            </li>
            <li>
              <strong>安全信息：</strong>为限制恶意注册和验证码滥用，我们会保存经过不可逆哈希处理的
              网络地址（IP）以及请求时间，不保存可直接识别的原始 IP 明文。
            </li>
            <li>
              <strong>邮件验证码：</strong>验证码只保存带密钥的哈希和有效期，不保存明文验证码。
            </li>
            <li>
              <strong>登录状态：</strong>通过 HttpOnly Cookie 保存登录凭证，用于维持登录状态。
            </li>
          </ul>

          <h2>2. 我们如何使用信息</h2>
          <ul>
            <li>验证邮箱归属、完成注册、登录和账号注销。</li>
            <li>在首页展示今天过生日的用户和公开资料，完成送蛋糕、切蛋糕和祝福统计。</li>
            <li>执行资料和生日的修改额度、匿名设置及安全规则。</li>
            <li>防止垃圾注册、恶意刷量、验证码滥用和其他安全风险。</li>
            <li>在你联系开发者时，处理你的问题和账号请求。</li>
          </ul>
          <p>
            我们不会出售你的个人信息，也不会将信息用于广告画像、跨站追踪或与本站功能无关的营销。
          </p>

          <h2>3. 哪些信息会公开展示</h2>
          <ul>
            <li>昵称、称呼或匿名展示状态。</li>
            <li>头像；未上传时显示纯黑圆形。</li>
            <li>简介；为空时不展示任何简介文字。</li>
            <li>生日只展示月和日，且仅在生日当天出现在首页。</li>
            <li>
              开启匿名后，其他人在首页看到的是「匿名的朋友」；你在「我」页仍然能看到自己的称呼。
            </li>
          </ul>
          <p>
            邮箱、UID、密码哈希、生日年份、IP 哈希、验证码、修改额度明细不会出现在公开首页。
            你可以在「我」页随时修改公开资料。
          </p>

          <h2>4. 第三方服务</h2>
          <p>为了提供服务和发送验证码，我们会使用以下基础设施：</p>
          <ul>
            <li>
              <strong>Netlify：</strong>网站托管、页面与接口运行，会处理访问请求和必要的技术日志。
            </li>
            <li>
              <strong>Turso：</strong>托管数据库，用于保存账号、资料、祝福和头像等数据。
            </li>
            <li>
              <strong>Resend：</strong>发送注册、绑定邮箱和注销账号的验证码。Resend
              会处理收件地址、验证码邮件内容和发送状态；实际发件地址由本站配置的已验证域名决定。
            </li>
          </ul>
          <p>
            这些服务商可能位于中国大陆以外的地区，使用本站即表示你理解数据可能跨境处理。
            我们不会把数据出售给第三方。
          </p>

          <h2>5. 保存期限</h2>
          <ul>
            <li>账号和资料保留至你主动注销账号，或本站停止服务并依法处理。</li>
            <li>过期的邮箱验证码会在短期后清理；限流记录只用于安全目的并定期失效。</li>
            <li>注销账号后，账号、UID、头像、资料、祝福、回礼、切蛋糕记录和修改额度会被删除。</li>
            <li>
              出于安全、备份或法律义务，删除可能需要短暂的技术处理时间。已经生成的手动灾难恢复备份可能仍在私密位置保存，
              仅用于整站故障恢复，不用于日常业务；如需确认备份处理情况，可联系开发者。
            </li>
          </ul>

          <h2>6. 你的权利</h2>
          <ul>
            <li>在「我」页查看和修改公开资料。</li>
            <li>在「我 → 其他 → 隐私协议」查看本协议，在「其他」中联系开发者。</li>
            <li>
              在「我 → 其他 → 注销账号」中通过邮箱验证删除账号及关联数据，UID 会被回收。
            </li>
            <li>如需进一步查询、复制或删除信息，可通过下方联系方式联系开发者。</li>
          </ul>

          <h2>7. 安全措施</h2>
          <p>
            我们采用密码哈希、HttpOnly 登录 Cookie、邮箱验证码、接口参数校验、数据库事务和
            基础限流措施保护数据。但互联网服务不存在绝对安全，请使用独立且足够强的密码，
            不要向任何人透露验证码、密码或登录 Cookie。
          </p>

          <h2>8. 未成年人</h2>
          <p>
            本站不是专门面向未成年人的产品。未满 14 周岁的未成年人应在监护人同意和指导下使用；
            如监护人发现未成年人未经同意提交了信息，可以联系开发者删除。
          </p>

          <h2>9. 协议更新</h2>
          <p>
            如果功能或数据处理方式发生重要变化，我们会更新本协议并在页面上标注新的生效日期。
            继续使用本站表示你接受更新后的协议。
          </p>

          <h2>10. 联系我们</h2>
          <div className="legal-contact">
            <p>
              <span>开发者：绛河</span>
              <strong>QQ 3586107948</strong>
            </p>
            <p>
              <span>开发者：绛河の大肥鱼</span>
              <strong>QQ 2597530663</strong>
            </p>
            <p>
              <span>BirtHappy 用户群</span>
              <strong>QQ 群 1049433315</strong>
            </p>
          </div>
        </div>

        <Link className="button button--primary legal-return" href="/me">
          回到「我」页
          <ArrowIcon className="button__icon" />
        </Link>
      </div>
    </div>
  );
}
