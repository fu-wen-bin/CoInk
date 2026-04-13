import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

type SendLoginCodeParams = {
  email: string;
  code: string;
  expiresInMinutes: number;
};

@Injectable()
export class EmailService {
  private transporter: Transporter | null = null;
  private readonly brandName = 'CoInk';

  private get smtpHost() {
    return process.env.SMTP_HOST?.trim() ?? '';
  }

  private get smtpPort() {
    const port = Number(process.env.SMTP_PORT ?? '587');
    return Number.isFinite(port) ? port : 587;
  }

  private get smtpSecure() {
    if (process.env.SMTP_SECURE) {
      return process.env.SMTP_SECURE === 'true';
    }
    return this.smtpPort === 465;
  }

  private get smtpUser() {
    return process.env.SMTP_USER?.trim() ?? '';
  }

  private get smtpPass() {
    return process.env.SMTP_PASS ?? '';
  }

  private get smtpFrom() {
    return process.env.SMTP_FROM?.trim() ?? '';
  }

  private isConfigured() {
    return Boolean(
      this.smtpHost && this.smtpPort && this.smtpUser && this.smtpPass && this.smtpFrom,
    );
  }

  private getTransporter(): Transporter {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('邮件服务未配置，请联系管理员');
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });
    }

    return this.transporter;
  }

  async sendLoginCode(params: SendLoginCodeParams) {
    const { email, code, expiresInMinutes } = params;
    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: this.smtpFrom,
      to: email,
      subject: `${this.brandName} 登录验证码`,
      text: this.buildLoginCodeText(code, expiresInMinutes),
      html: this.buildLoginCodeHtml(code, expiresInMinutes),
    });
  }

  private buildLoginCodeText(code: string, expiresInMinutes: number): string {
    return [
      `【${this.brandName}】登录验证码`,
      '',
      `您的验证码：${code}`,
      `有效期：${expiresInMinutes} 分钟`,
      '',
      '请勿将验证码泄露给任何人。',
      '如果不是您本人操作，请忽略本邮件。',
    ].join('\n');
  }

  private buildLoginCodeHtml(code: string, expiresInMinutes: number): string {
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${this.brandName} 登录验证码</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f4f8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f4f8" style="background-color:#f2f4f8;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
            <tr>
              <td bgcolor="#1f3f93" style="padding:20px 24px;border-radius:14px 14px 0 0;font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;">
                <div style="font-size:14px;font-weight:700;color:#c7d7ff;letter-spacing:0.2px;">${this.brandName}</div>
                <div style="margin-top:8px;font-size:28px;font-weight:800;line-height:1.25;color:#ffffff;">登录验证码</div>
                <div style="margin-top:8px;font-size:14px;line-height:1.6;color:#e7eeff;">用于登录或首次注册，请在页面内输入。</div>
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:24px;border-left:1px solid #e5eaf3;border-right:1px solid #e5eaf3;font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#1f2937;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">
                  你好，你正在进行 <strong>${this.brandName}</strong> 的登录验证。
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f8ff" style="border:1px solid #d8e3ff;border-radius:12px;background-color:#f5f8ff;">
                  <tr>
                    <td align="center" style="padding:14px 12px 8px;font-size:14px;font-weight:600;color:#335ec9;">请在页面输入以下验证码</td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:0 12px 16px;">
                      <span style="display:inline-block;font-size:42px;line-height:1;font-weight:800;letter-spacing:6px;color:#0f1d40;font-family:'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">${code}</span>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0;font-size:14px;line-height:1.9;color:#475467;">
                  验证码有效期为 <strong style="color:#111827;">${expiresInMinutes} 分钟</strong>。<br />
                  请勿将验证码告知他人，平台工作人员不会以任何理由向你索取验证码。
                </p>
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" style="padding:0 24px 20px;border:1px solid #e5eaf3;border-top:0;border-radius:0 0 14px 14px;font-family:'PingFang SC','Microsoft YaHei',Arial,sans-serif;">
                <div style="height:1px;line-height:1px;font-size:1px;background-color:#e5eaf3;">&nbsp;</div>
                <p style="margin:14px 0 0;font-size:12px;line-height:1.8;color:#8591a5;">
                  如果这不是你的操作，请忽略此邮件。<br />
                  这是一封系统邮件，请勿直接回复。
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
