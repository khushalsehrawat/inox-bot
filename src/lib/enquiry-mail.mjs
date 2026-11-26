import nodemailer from 'nodemailer';

export function enquiryNotification(id, enquiry, sender, recipient) {
  const items = enquiry.items.map(item =>
    `- ${item.name} | SKU: ${item.sku} | Quantity: ${item.quantity}`);
  return {
    from: { name: 'INOX Website', address: sender },
    to: recipient,
    replyTo: { name: enquiry.name, address: enquiry.email },
    subject: `New INOX enquiry — ${id}`,
    text: [
      'A new enquiry has been saved in the INOX admin panel.',
      `Reference: ${id}`, '',
      `Name: ${enquiry.name}`, `Email: ${enquiry.email}`,
      `Phone: ${enquiry.phone}`, `Company: ${enquiry.company || '—'}`,
      `City: ${enquiry.city || '—'}`, `Type: ${enquiry.type}`, '',
      'Message:', enquiry.message, '', 'Products:',
      ...(items.length ? items : ['No products selected.']),
    ].join('\n'),
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

// Called only after the database transaction commits. Email failure must never
// turn a saved enquiry into a failed submission (which could cause duplicates).
export async function notifySavedEnquiry(id, enquiry, {
  env = process.env,
  createTransport = nodemailer.createTransport,
  logger = console,
} = {}) {
  const user = env.ENQUIRY_SMTP_USER?.trim();
  const pass = env.ENQUIRY_SMTP_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) {
    logger.warn(`[enquiry-mail] not configured; enquiry ${id} remains saved`);
    return 'not-configured';
  }
  try {
    const transport = createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user, pass },
      connectionTimeout: 10000, greetingTimeout: 10000,
      socketTimeout: 10000, dnsTimeout: 10000,
      tls: { minVersion: 'TLSv1.2' },
      logger: false, debug: false,
    });
    const recipient = env.ENQUIRY_NOTIFY_TO?.trim() || 'info@inoxdecor.com';
    const result = await transport.sendMail(enquiryNotification(id, enquiry, user, recipient));
    if (!result.accepted?.length || result.rejected?.length) throw new Error('Recipient rejected');
    logger.info(`[enquiry-mail] accepted by SMTP for enquiry ${id}`);
    return 'accepted';
  } catch {
    // Do not log SMTP responses, credentials, message bodies or customer details.
    logger.error(`[enquiry-mail] delivery failed for enquiry ${id}; enquiry remains saved`);
    return 'failed';
  }
}
