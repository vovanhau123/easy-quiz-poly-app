const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendVerificationEmail = async (to, code) => {
  if (!to) {
    console.error("No recipient email provided");
    return false;
  }

  // Tạo mã code với định dạng đẹp hơn
  const formattedCode = code.split("").join(" ");

  const mailOptions = {
    from: {
      name: "Butterfly Drive",
      address: process.env.EMAIL_USER,
    },
    to: to.trim(),
    subject: "Verify Your Account - Butterfly Drive",
    html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        margin: 0;
                        padding: 0;
                        background-color: #f9fafb;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: white;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        background: linear-gradient(135deg, #3b82f6, #2563eb);
                        padding: 40px 20px;
                        text-align: center;
                    }
                    .logo {
                        width: 100px;
                        height: 100px;
                        margin-bottom: 20px;
                    }
                    .title {
                        color: white;
                        font-size: 28px;
                        margin: 0;
                        font-weight: 600;
                    }
                    .content {
                        padding: 40px 30px;
                        background: white;
                    }
                    .greeting {
                        font-size: 20px;
                        color: #1f2937;
                        margin-bottom: 20px;
                    }
                    .message {
                        color: #4b5563;
                        margin-bottom: 30px;
                    }
                    .code-container {
                        background: #f3f4f6;
                        border-radius: 12px;
                        padding: 20px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .code {
                        font-size: 32px;
                        font-weight: 600;
                        color: #2563eb;
                        letter-spacing: 8px;
                        font-family: monospace;
                    }
                    .expiry {
                        margin-top: 30px;
                        padding: 15px;
                        background: #fff8f1;
                        border-left: 4px solid #f97316;
                        color: #9a3412;
                        border-radius: 6px;
                    }
                    .footer {
                        text-align: center;
                        padding: 20px;
                        background: #f9fafb;
                        color: #6b7280;
                        font-size: 14px;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 24px;
                        background: #2563eb;
                        color: white;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 500;
                        margin-top: 20px;
                    }
                    @media only screen and (max-width: 600px) {
                        .container {
                            margin: 0;
                            border-radius: 0;
                        }
                        .content {
                            padding: 30px 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="https://i.pinimg.com/originals/ee/ea/d9/eeead92b0aedfa44533148cad88f0d5b.gif" alt="Butterfly Drive Logo" class="logo">
                        <h1 class="title">Verify Your Account</h1>
                    </div>
                    <div class="content">
                        <h2 class="greeting">Welcome to Butterfly Drive! 🦋</h2>
                        <p class="message">
                            Thank you for joining us! To ensure the security of your account, please verify your email address using the verification code below:
                        </p>
                        <div class="code-container">
                            <div class="code">${formattedCode}</div>
                        </div>
                        <div class="expiry">
                            <strong>⚠️ Important:</strong> This code will expire in 10 minutes for security reasons.
                        </div>
                        <p class="message">
                            If you didn't request this verification code, please ignore this email or contact our support team if you have concerns.
                        </p>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Butterfly Drive. All rights reserved.</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
  };

  try {
    console.log("Sending email to:", to);
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
};

// Kiểm tra kết nối email khi khởi động server
const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("Email service is ready");
    return true;
  } catch (error) {
    console.error("Email service error:", error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  verifyEmailConnection,
};
