import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { escapeHtml } from '@/lib/sanitize';

const resend = new Resend(process.env.RESEND_API_KEY || 'missing_api_key');

/** Comma-separated ADMIN_EMAIL supported (e.g. "a@x.com,b@y.com"). */
function adminRecipients(): string[] {
    const raw = process.env.ADMIN_EMAIL || 'hello@maamekskitchen.ca';
    return raw
        .split(',')
        .map((e) => e.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
}

function emailFromAddress(): string {
    const raw = (process.env.EMAIL_FROM || "Maame K’s Kitchen <noreply@maamekskitchen.ca>")
        .trim()
        .replace(/^["']|["']$/g, '');
    if (raw.includes('<') && raw.includes('>')) return raw;
    if (raw.includes('@')) return `Maame K’s Kitchen <${raw}>`;
    return "Maame K’s Kitchen <noreply@maamekskitchen.ca>";
}

const BRAND = {
    name: "Maame K’s Kitchen",
    color: '#059669',
    colorLight: '#ecfdf5',
    colorDark: '#064e3b',
    url: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
};

// Reusable branded email layout
export function emailLayout(body: string, preheader?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${BRAND.name}</title>
${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,${BRAND.color},${BRAND.colorDark});padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">${BRAND.name}</h1>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Premium Quality Products</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:40px 40px 32px;">
${body}
</td></tr>

<!-- Footer -->
<tr><td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;">
<p style="margin:0 0 12px;color:#6b7280;font-size:13px;"><a href="${BRAND.url}" style="color:${BRAND.color};text-decoration:none;">Visit our store</a> &nbsp;·&nbsp; <a href="${BRAND.url}/order-tracking" style="color:${BRAND.color};text-decoration:none;">Track order</a></p>
<p style="margin:0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</p>
</td></tr>
</table>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// Reusable styled button
function emailButton(text: string, href: string, color?: string): string {
    const bg = color || BRAND.color;
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr>
<td style="background-color:${bg};border-radius:8px;"><a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">${text}</a></td>
</tr></table>`;
}

// Reusable info row
function emailInfoRow(label: string, value: string): string {
    return `<tr>
<td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;width:40%;">${label}</td>
<td style="padding:10px 16px;color:#111827;font-size:14px;font-weight:600;border-bottom:1px solid #f3f4f6;">${value}</td>
</tr>`;
}

// Shipping notes block
function emailShippingNotes(notes: string[]): string {
    if (notes.length === 0) return '';
    return `<div style="background-color:#ecfdf5;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin:20px 0;">
<p style="font-weight:600;color:#92400e;margin:0 0 6px;font-size:13px;">&#9200; Shipping Notes</p>
${notes.map(n => `<p style="color:#78350f;margin:3px 0;font-size:13px;">${n}</p>`).join('')}
</div>`;
}

// Helper to mask sensitive data in logs
function maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return '***';
    return phone.slice(0, 4) + '****' + phone.slice(-2);
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('[Email] RESEND_API_KEY not configured');
        return null;
    }
    const recipients = (Array.isArray(to) ? to : [to])
        .flatMap((entry) => String(entry).split(','))
        .map((e) => e.trim())
        .filter(Boolean);
    if (recipients.length === 0) {
        console.warn('[Email] No recipients');
        return null;
    }
    try {
        const { data, error } = await resend.emails.send({
            from: emailFromAddress(),
            to: recipients,
            subject,
            html,
        });
        if (error) {
            console.error('[Email] Resend error:', error.message || JSON.stringify(error));
            return null;
        }
        console.log(
            '[Email] Sent successfully to:',
            recipients.map((r) => r.split('@')[0] + '@***').join(', '),
            'id=',
            data?.id || 'n/a'
        );
        return data;
    } catch (error: any) {
        console.error('[Email] Failed:', error.message);
        return null;
    }
}

function orderCustomerName(order: any): string {
    const shipping_address = order?.shipping_address;
    const metadata = order?.metadata;
    if (shipping_address?.full_name) return shipping_address.full_name;
    if (shipping_address?.firstName) {
        return shipping_address.lastName
            ? `${shipping_address.firstName} ${shipping_address.lastName}`
            : shipping_address.firstName;
    }
    if (metadata?.first_name) {
        return metadata.last_name
            ? `${metadata.first_name} ${metadata.last_name}`
            : metadata.first_name;
    }
    return 'Customer';
}

/**
 * Admin-only alert when an order is placed (including Stripe before payment).
 * Customer confirmation is sent separately after payment / COD finalize.
 */
export async function sendAdminNewOrderAlert(order: any) {
    const { id, email, total, created_at, order_number, payment_status, status } = order || {};
    if (!order_number && !id) {
        console.warn('[Notification] Admin alert skipped — missing order id');
        return;
    }
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const name = orderCustomerName(order);
    const payLabel = payment_status || status || 'pending';
    const admins = adminRecipients();
    if (admins.length === 0) {
        console.warn('[Notification] ADMIN_EMAIL not set — skipping admin alert');
        return;
    }

    const html = emailLayout(`
<h2 style="margin:0 0 16px;color:#111827;font-size:20px;">New Order Received</h2>
<p style="color:#6b7280;font-size:14px;margin:0 0 16px;">Payment status: <strong style="color:#111827;">${escapeHtml(String(payLabel))}</strong></p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;overflow:hidden;margin:16px 0;">
  ${emailInfoRow('Order', `#${order_number || id}`)}
  ${emailInfoRow('Customer', escapeHtml(name))}
  ${emailInfoRow('Email', escapeHtml(email || '—'))}
  ${emailInfoRow('Total', `$${Number(total || 0).toFixed(2)}`)}
  ${created_at ? emailInfoRow('Placed', new Date(created_at).toLocaleString('en-CA', { timeZone: 'America/Edmonton' })) : ''}
</table>

${emailButton('View Order in Admin', `${baseUrl}/admin/orders/${id || ''}`)}
`, `New order #${order_number || id} from ${name}`);

    await sendEmail({
        to: admins.join(','),
        subject: `New Order #${order_number || id} (${payLabel})`,
        html,
    });
}

// E.164 phone formatting.
// Set DEFAULT_COUNTRY_CODE in your environment to your country's dialing code
// (e.g. '1', '44', '49', '61', '91', etc.).
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '1';
function formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith(DEFAULT_COUNTRY_CODE) && cleaned.length >= DEFAULT_COUNTRY_CODE.length + 9) return '+' + cleaned;
    if (cleaned.startsWith('0') && cleaned.length >= 10) cleaned = DEFAULT_COUNTRY_CODE + cleaned.substring(1);
    if (cleaned.length === 9) cleaned = DEFAULT_COUNTRY_CODE + cleaned;
    return '+' + cleaned;
}

export async function sendSMS({ to, message }: { to: string; message: string }) {
    // Moolre SMS API only requires X-API-VASKEY header for authentication
    // See: https://docs.moolre.com/#/send-sms
    // Allow MOOLRE_SMS_API_KEY or fall back to MOOLRE_API_KEY
    const smsVasKey = process.env.MOOLRE_SMS_API_KEY || process.env.MOOLRE_API_KEY;

    if (!smsVasKey) {
        console.warn('[SMS] Missing MOOLRE_SMS_API_KEY or MOOLRE_API_KEY');
        return null;
    }

    const recipient = formatPhoneNumber(to);
    // Use the same env var name as our other Moolre projects so the
    // sender ID can be changed in one place per environment.
    const senderId = process.env.SMS_SENDER_ID || process.env.MOOLRE_SMS_SENDER_ID || 'MaameKitch';

    try {
        console.log(`[SMS] Sending to ${maskPhone(recipient)} from "${senderId}"`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        const response = await fetch('https://api.moolre.com/open/sms/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-VASKEY': smsVasKey
            },
            body: JSON.stringify({
                type: 1,
                senderid: senderId,
                messages: [
                    {
                        recipient: recipient,
                        message: message
                    }
                ]
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[SMS] Non-JSON response:', text.slice(0, 200));
            return { status: 0, error: text.slice(0, 200) };
        }

        const result = await response.json();
        console.log('[SMS] Result:', result.status === 1 ? 'Success' : 'Failed', '| Code:', result.code);
        if (result.status !== 1) {
            console.log('[SMS] Full Response:', JSON.stringify(result, null, 2));
        }
        return result;
    } catch (error: any) {
        console.error('[SMS] Error:', error.message);
        return null;
    }
}

export async function sendOrderConfirmation(order: any) {
    const { id, email, phone: orderPhone, shipping_address, total, created_at, order_number, metadata } = order;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const name = orderCustomerName(order);

    // Prefer top-level phone, then shipping address phone
    const phone = orderPhone || shipping_address?.phone;

    // Get tracking number from metadata
    const trackingNumber = metadata?.tracking_number || '';
    const trackingUrl = `${baseUrl}/order-tracking?order=${order_number || id}`;

    console.log(`[Notification] Preparing for Order #${order_number} | Phone: ${phone ? 'Present' : 'Missing'} | Tracking: ${trackingNumber || 'None'}`);

    // Fetch order items to get preorder_shipping info
    let shippingNotes: string[] = [];
    try {
        const { data: items } = await supabaseAdmin
            .from('order_items')
            .select('product_name, metadata')
            .eq('order_id', id);
        if (items) {
            for (const item of items) {
                const preorder = item.metadata?.preorder_shipping;
                if (preorder) {
                    shippingNotes.push(`${item.product_name}: ${preorder}`);
                }
            }
        }
    } catch (err) {
        console.warn('[Notification] Could not fetch order items for shipping notes');
    }

    const shippingNotesSms = shippingNotes.length > 0
        ? ` Note: ${shippingNotes.join('; ')}.`
        : '';

    // 1. Email to Customer
    const customerEmailHtml = emailLayout(`
<div style="text-align:center;margin-bottom:24px;">
  <div style="width:64px;height:64px;background-color:${BRAND.colorLight};border-radius:50%;margin:0 auto 16px;line-height:64px;font-size:28px;">&#10003;</div>
  <h2 style="margin:0 0 4px;color:#111827;font-size:24px;">Order Confirmed!</h2>
  <p style="margin:0;color:#6b7280;font-size:15px;">Thank you for your purchase, ${name}.</p>
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;overflow:hidden;margin:20px 0;">
  ${emailInfoRow('Order Number', `#${order_number || id}`)}
  ${emailInfoRow('Order Date', new Date(created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}
  ${trackingNumber ? emailInfoRow('Tracking', trackingNumber) : ''}
  ${emailInfoRow('Total', `$${Number(total).toFixed(2)}`)}
</table>

${emailShippingNotes(shippingNotes)}

<p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0;">We're getting your order ready. You'll receive updates as it's processed and packaged.</p>

${emailButton('Track Your Order', trackingUrl)}

<p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Or copy this link: <a href="${trackingUrl}" style="color:${BRAND.color};">${trackingUrl}</a></p>
`, `Your order #${order_number || id} is confirmed!`);

    await sendEmail({
        to: email,
        subject: `Order Confirmed! #${order_number || id}`,
        html: customerEmailHtml
    });

    // 2. Email to Admin
    const adminEmailHtml = emailLayout(`
<h2 style="margin:0 0 16px;color:#111827;font-size:20px;">&#128230; New Order Received</h2>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;overflow:hidden;margin:16px 0;">
  ${emailInfoRow('Order', `#${order_number || id}`)}
  ${emailInfoRow('Customer', `${name}`)}
  ${emailInfoRow('Email', email)}
  ${emailInfoRow('Total', `$${Number(total).toFixed(2)}`)}
  ${trackingNumber ? emailInfoRow('Tracking', trackingNumber) : ''}
</table>

${emailShippingNotes(shippingNotes)}

${emailButton('View Order in Admin', `${baseUrl}/admin/orders/${id}`)}
`, `New order #${order_number} from ${name}`);

    await sendEmail({
        to: adminRecipients().join(','),
        subject: `Order Paid #${order_number || id}`,
        html: adminEmailHtml
    });

    // 3. SMS to Customer (if phone exists)
    if (phone) {
        const smsMessage = trackingNumber
            ? `Hi ${name}, your order #${order_number || id} is confirmed! Tracking: ${trackingNumber}. Track here: ${trackingUrl}${shippingNotesSms}`
            : `Hi ${name}, your order #${order_number || id} at our store is confirmed! Track here: ${trackingUrl}${shippingNotesSms}`;

        await sendSMS({
            to: phone,
            message: smsMessage
        });
    }
}

export async function sendOrderStatusUpdate(order: any, newStatus: string) {
    const { id, email, phone: orderPhone, shipping_address, order_number, metadata } = order;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

    // Build customer name from available sources
    const getName = () => {
        if (shipping_address?.full_name) return shipping_address.full_name;
        if (shipping_address?.firstName) {
            return shipping_address.lastName
                ? `${shipping_address.firstName} ${shipping_address.lastName}`
                : shipping_address.firstName;
        }
        if (metadata?.first_name) {
            return metadata.last_name
                ? `${metadata.first_name} ${metadata.last_name}`
                : metadata.first_name;
        }
        return 'Customer';
    };
    const name = getName();
    const phone = orderPhone || shipping_address?.phone;
    const trackingNumber = metadata?.tracking_number || '';
    const trackingUrl = `${baseUrl}/order-tracking?order=${order_number || id}`;

    console.log(`[Notification] Status update for Order #${order_number} to ${newStatus} | Tracking: ${trackingNumber}`);

    const subject = `Order Update #${order_number || id}`;
    let message = `Your order #${order_number || id} status has been updated to ${newStatus}.`;
    let smsMessage = message;

    if (newStatus === 'shipped') {
        message = `Good news! Your order #${order_number || id} has been packaged and is ready.`;
        smsMessage = trackingNumber
            ? `Good news ${name}! Order #${order_number || id} has been packaged. Tracking: ${trackingNumber}. Track: ${trackingUrl}`
            : `Good news ${name}! Order #${order_number || id} has been packaged. Track: ${trackingUrl}`;
    } else if (newStatus === 'delivered') {
        message = `Your order #${order_number || id} has been delivered. Enjoy!`;
        smsMessage = `Hi ${name}, your order #${order_number || id} has been delivered. Enjoy your purchase!`;
    } else if (newStatus === 'processing') {
        smsMessage = trackingNumber
            ? `Hi ${name}, your order #${order_number || id} is being processed. Tracking: ${trackingNumber}. Track: ${trackingUrl}`
            : `Hi ${name}, your order #${order_number || id} is being processed. Track: ${trackingUrl}`;
    } else {
        smsMessage = `Hi ${name}, order #${order_number || id} status: ${newStatus}. Track: ${trackingUrl}`;
    }

    // Status icons/colors
    const statusConfig: Record<string, { icon: string; color: string; bg: string }> = {
        processing: { icon: '&#9881;', color: '#059669', bg: '#ecfdf5' },
        shipped: { icon: '&#128666;', color: '#059669', bg: '#ecfdf5' },
        delivered: { icon: '&#127881;', color: '#16a34a', bg: '#f0fdf4' },
        cancelled: { icon: '&#10060;', color: '#059669', bg: '#ecfdf5' },
    };
    const sc = statusConfig[newStatus] || { icon: '&#128276;', color: '#6b7280', bg: '#f9fafb' };

    await sendEmail({
        to: email,
        subject: subject,
        html: emailLayout(`
<div style="text-align:center;margin-bottom:24px;">
  <div style="width:64px;height:64px;background-color:${sc.bg};border-radius:50%;margin:0 auto 16px;line-height:64px;font-size:28px;">${sc.icon}</div>
  <h2 style="margin:0 0 4px;color:#111827;font-size:22px;">Order Update</h2>
  <p style="margin:0;color:#6b7280;font-size:14px;">Hi ${name}, here's an update on your order.</p>
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;overflow:hidden;margin:20px 0;">
  ${emailInfoRow('Order Number', `#${order_number || id}`)}
  ${emailInfoRow('New Status', `<span style="display:inline-block;background-color:${sc.bg};color:${sc.color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;">${newStatus}</span>`)}
  ${trackingNumber ? emailInfoRow('Tracking Number', trackingNumber) : ''}
</table>

<p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0;">${message}</p>

${emailButton('Track Your Order', trackingUrl)}
`, `Your order #${order_number} is now ${newStatus}`)
    });

    // SMS
    if (phone) {
        await sendSMS({
            to: phone,
            message: smsMessage
        });
    }
}

export async function sendWelcomeMessage(user: { email: string, firstName: string, phone?: string }) {
    const { email, firstName, phone } = user;

    // Email
    await sendEmail({
        to: email,
        subject: `Welcome to ${BRAND.name}!`,
        html: emailLayout(`
<div style="text-align:center;margin-bottom:24px;">
  <div style="width:64px;height:64px;background-color:${BRAND.colorLight};border-radius:50%;margin:0 auto 16px;line-height:64px;font-size:28px;">&#128075;</div>
  <h2 style="margin:0 0 4px;color:#111827;font-size:24px;">Welcome, ${firstName}!</h2>
  <p style="margin:0;color:#6b7280;font-size:15px;">We're so glad you're here.</p>
</div>

<p style="color:#374151;font-size:14px;line-height:1.7;margin:16px 0;">Thank you for joining the ${BRAND.name} family. We source premium quality products directly from China at unbeatable prices &mdash; perfect for homes, businesses, and resellers.</p>

<div style="background-color:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="text-align:center;padding:8px;width:33%;">
        <p style="font-size:20px;margin:0 0 4px;">&#128666;</p>
        <p style="color:#374151;font-size:12px;font-weight:600;margin:0;">Free Pickup</p>
        <p style="color:#9ca3af;font-size:11px;margin:2px 0 0;">Available in store</p>
      </td>
      <td style="text-align:center;padding:8px;width:33%;">
        <p style="font-size:20px;margin:0 0 4px;">&#9989;</p>
        <p style="color:#374151;font-size:12px;font-weight:600;margin:0;">Verified Quality</p>
        <p style="color:#9ca3af;font-size:11px;margin:2px 0 0;">Hand-inspected</p>
      </td>
      <td style="text-align:center;padding:8px;width:33%;">
        <p style="font-size:20px;margin:0 0 4px;">&#128176;</p>
        <p style="color:#374151;font-size:12px;font-weight:600;margin:0;">Best Prices</p>
        <p style="color:#9ca3af;font-size:11px;margin:2px 0 0;">Unbeatable value</p>
      </td>
    </tr>
  </table>
</div>

${emailButton('Start Shopping', `${BRAND.url}/menu`)}
`, `Welcome to ${BRAND.name}, ${firstName}!`)
    });

    // SMS
    if (phone) {
        await sendSMS({
            to: phone,
            message: `Welcome ${firstName}! Thanks for joining our store.`
        });
    }
}

export async function sendPaymentLink(order: any) {
    const { id, email, phone: orderPhone, shipping_address, total, order_number, metadata } = order;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const paymentUrl = `${baseUrl}/pay/${id}`;

    // Build customer name from available sources
    const getName = () => {
        if (shipping_address?.full_name) return shipping_address.full_name;
        if (shipping_address?.firstName) {
            return shipping_address.lastName
                ? `${shipping_address.firstName} ${shipping_address.lastName}`
                : shipping_address.firstName;
        }
        if (metadata?.first_name) {
            return metadata.last_name
                ? `${metadata.first_name} ${metadata.last_name}`
                : metadata.first_name;
        }
        return 'Customer';
    };
    const name = getName();
    const phone = orderPhone || shipping_address?.phone;

    console.log(`[Notification] Sending payment link for Order #${order_number} | Phone: ${phone ? 'Present' : 'Missing'}`);

    // Email with payment link
    await sendEmail({
        to: email,
        subject: `Complete Your Order #${order_number}`,
        html: emailLayout(`
<div style="text-align:center;margin-bottom:24px;">
  <div style="width:64px;height:64px;background-color:#d1fae5;border-radius:50%;margin:0 auto 16px;line-height:64px;font-size:28px;">&#128179;</div>
  <h2 style="margin:0 0 4px;color:#111827;font-size:22px;">Complete Your Order</h2>
  <p style="margin:0;color:#6b7280;font-size:14px;">Hi ${name}, your order is waiting for payment.</p>
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;overflow:hidden;margin:20px 0;">
  ${emailInfoRow('Order Number', `#${order_number}`)}
  ${emailInfoRow('Amount Due', `<span style="color:${BRAND.color};font-size:18px;font-weight:700;">$${Number(total).toFixed(2)}</span>`)}
</table>

<p style="color:#374151;font-size:14px;line-height:1.6;margin:16px 0;">Click the button below to securely complete your payment. This link will remain active until your order is completed or cancelled.</p>

${emailButton('Pay Now — $' + Number(total).toFixed(2), paymentUrl, '#047857')}

<p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">Or copy this link: <a href="${paymentUrl}" style="color:${BRAND.color};">${paymentUrl}</a></p>
`, `Complete payment for order #${order_number}`)
    });

    // SMS with payment link
    if (phone) {
        const smsMessage = `Hi ${name}, complete your order #${order_number} ($${Number(total).toFixed(2)}) here: ${paymentUrl}`;

        await sendSMS({
            to: phone,
            message: smsMessage
        });
    }
}

export async function sendContactMessage(data: { name: string, email: string, subject: string, message: string }) {
    const { name, email, subject, message } = data;

    // SECURITY: Sanitize all user input before injecting into HTML
    const safeName = escapeHtml(name);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);
    const safeEmail = escapeHtml(email);

    // 1. Acknowledge to User
    await sendEmail({
        to: email,
        subject: `We received your message: ${subject}`,
        html: emailLayout(`
<div style="text-align:center;margin-bottom:24px;">
  <div style="width:64px;height:64px;background-color:${BRAND.colorLight};border-radius:50%;margin:0 auto 16px;line-height:64px;font-size:28px;">&#128172;</div>
  <h2 style="margin:0 0 4px;color:#111827;font-size:22px;">Message Received</h2>
  <p style="margin:0;color:#6b7280;font-size:14px;">We'll get back to you soon.</p>
</div>

<p style="color:#374151;font-size:14px;line-height:1.7;margin:16px 0;">Hi ${safeName},</p>
<p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">Thank you for reaching out to ${BRAND.name}. We've received your message regarding <strong>"${safeSubject}"</strong> and our team will respond as soon as possible.</p>

<div style="background-color:#f9fafb;border-left:4px solid ${BRAND.color};border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
  <p style="color:#6b7280;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Your message</p>
  <p style="color:#374151;font-size:14px;margin:0;line-height:1.6;">${safeMessage}</p>
</div>

<p style="color:#6b7280;font-size:13px;margin:16px 0 0;">We typically respond within 24 hours.</p>
`, `Thanks for contacting us, ${safeName}`)
    });

    // 2. Alert Admin
    await sendEmail({
        to: adminRecipients().join(','),
        subject: `Contact: ${subject}`,
        html: emailLayout(`
<h2 style="margin:0 0 16px;color:#111827;font-size:20px;">&#128233; New Contact Message</h2>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;overflow:hidden;margin:16px 0;">
  ${emailInfoRow('From', safeName)}
  ${emailInfoRow('Email', `<a href="mailto:${safeEmail}" style="color:${BRAND.color};">${safeEmail}</a>`)}
  ${emailInfoRow('Subject', safeSubject)}
</table>

<div style="background-color:#f9fafb;border-left:4px solid ${BRAND.color};border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
  <p style="color:#6b7280;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
  <p style="color:#374151;font-size:14px;margin:0;line-height:1.6;">${safeMessage}</p>
</div>

${emailButton('Reply to ' + safeName, `mailto:${safeEmail}?subject=Re: ${encodeURIComponent(subject)}`)}
`, `New contact from ${safeName}: ${safeSubject}`)
    });
}
