// handlers/notifications.js — SNS → SES email notification

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const ses = new SESClient({ region: process.env.AWS_REGION });

const FROM_EMAIL = process.env.SES_FROM_EMAIL;

/**
 * Triggered by SNS when a file upload completes
 */
exports.handleUploadNotification = async (event) => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);

      if (message.type === 'UPLOAD_COMPLETE') {
        await sendUploadCompleteEmail(message);
      }
    } catch (err) {
      console.error('Notification error:', err);
    }
  }
};

async function sendUploadCompleteEmail({ fileName, fileSize, userEmail, uploadedAt }) {
  const formattedSize = formatBytes(fileSize);
  const formattedDate = new Date(uploadedAt).toLocaleString();

  await ses.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [userEmail] },
    Message: {
      Subject: {
        Data: `✅ Upload complete: ${fileName}`,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#2563eb">File uploaded successfully</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px;color:#666">File name</td>
                    <td style="padding:8px;font-weight:bold">${escapeHtml(fileName)}</td></tr>
                <tr style="background:#f9f9f9">
                    <td style="padding:8px;color:#666">Size</td>
                    <td style="padding:8px">${formattedSize}</td></tr>
                <tr><td style="padding:8px;color:#666">Uploaded at</td>
                    <td style="padding:8px">${formattedDate}</td></tr>
              </table>
              <p style="margin-top:20px;color:#666;font-size:14px">
                Log in to your Cloud Storage account to access your file.
              </p>
            </div>
          `,
        },
      },
    },
  }));

  console.log(`Email sent to ${userEmail} for file: ${fileName}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}
