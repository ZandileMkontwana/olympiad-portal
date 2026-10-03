// Shared branded layout for every outgoing portal email. Table-based with
// inline styles throughout — email clients strip <style> blocks and ignore
// most modern CSS, so the markup has to carry its own styling. Colors mirror
// the frontend theme tokens in frontend/src/app/globals.css.

const BRAND = {
  name: 'Olympiad Portal',
  deep: '#4c3f82', // --color-lavender-deep: header band + headings
  lavender: '#6c5ca6', // --color-lavender: buttons
  light: '#f5effa', // --light-lavender: footer band
  border: '#d8c9e8', // --border-lavender: card border
  paper: '#faf7fd', // --background: page background
  ink: '#211b33', // --color-ink: body text
  inkSoft: '#6b6480', // --color-ink-soft: muted footer text
};

// Absolute URL for a frontend path, or null when FRONTEND_URL is not
// configured. Emails can only reference the logo and portal pages through
// this env var because SendGrid has no access to relative paths.
function frontendUrl(path = '/') {
  const base = process.env.FRONTEND_URL;
  if (!base) return null;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/+$/, '')}${suffix}`;
}

// The tree-mark logo lives in the frontend's /public folder, so it is only
// embeddable when FRONTEND_URL is set; without it the header degrades to the
// text wordmark alone (email clients also commonly block remote images).
function headerCell() {
  const logo = frontendUrl('/tree-mark.png');
  const logoHtml = logo
    ? `<img src="${logo}" width="30" height="30" alt="" style="display:inline-block;vertical-align:middle;border-radius:8px;margin-right:10px;" />`
    : '';
  return (
    `<td style="background:${BRAND.deep};padding:18px 28px;">` +
    `${logoHtml}` +
    `<span style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:bold;letter-spacing:0.4px;vertical-align:middle;">${BRAND.name}</span>` +
    `</td>`
  );
}

function ctaButton(label, href) {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 4px;">` +
    `<tr><td style="background:${BRAND.lavender};border-radius:8px;">` +
    `<a href="${href}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;">${label}</a>` +
    `</td></tr></table>`
  );
}

function brandEmailHtml({ heading, bodyHtml, cta }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
            <tr>${headerCell()}</tr>
            <tr>
              <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
                <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:${BRAND.deep};">${heading}</h1>
                <div style="font-size:15px;line-height:1.6;">${bodyHtml}</div>
                ${cta || ''}
              </td>
            </tr>
            <tr>
              <td style="background:${BRAND.light};padding:14px 28px;border-top:1px solid ${BRAND.border};">
                <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.inkSoft};">
                  This is an automated message from ${BRAND.name} — replies to this address are not monitored.
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

module.exports = { BRAND, frontendUrl, ctaButton, brandEmailHtml };
