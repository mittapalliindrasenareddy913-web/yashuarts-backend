import nodemailer from 'nodemailer';

export const sendOTPEmail = async (email, otp) => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log(`--------------------------------------------------`);
  console.log(`📧 [OTP SENT] To: ${email} | OTP Code: ${otp}`);
  console.log(`--------------------------------------------------`);

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port == 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"YashuArts Support" <${user}>`,
        to: email,
        subject: 'YashuArts Password Reset OTP Code',
        text: `Your OTP for resetting password is: ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #121212; color: #ffffff; padding: 30px; border-radius: 15px; border: 1px solid #D4AF37;">
            <h2 style="color: #D4AF37; text-align: center; text-transform: uppercase; letter-spacing: 2px;">YashuArts Secure Reset</h2>
            <hr style="border-color: #333;" />
            <p>Hello,</p>
            <p>You requested a password reset for your YashuArts account. Please use the following One-Time Password (OTP) to reset your password:</p>
            <div style="background-color: #0b0b0b; padding: 20px; text-align: center; border-radius: 10px; border: 1px solid #333; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #D4AF37;">${otp}</span>
            </div>
            <p style="color: #a0a0a0; font-size: 12px; text-align: center; margin-top: 30px;">
              This code will expire in 10 minutes. If you did not make this request, you can safely ignore this email.
            </p>
          </div>
        `,
      });

      console.log(`Real email sent successfully. MessageId: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('Error sending SMTP email, falling back to mock:', error);
    }
  } else {
    console.log('No SMTP config found. Printed OTP to console above.');
  }
  return true;
};
