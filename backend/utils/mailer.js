const API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.MAIL_FROM;
const FROM_NAME = process.env.MAIL_FROM_NAME || "TaskFlow";
const enabled = Boolean(API_KEY && FROM_EMAIL);

if (!enabled) console.log("Email notifications are off (BREVO_API_KEY / MAIL_FROM not set)");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function layout(title, body, url, cta) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e0e3ee;border-radius:12px">
  <h2 style="margin:0 0 12px;color:#14172b">${title}</h2>
  <p style="color:#5a6078;line-height:1.5">${body}</p>
  <a href="${esc(url)}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#4c54f0;color:#fff;text-decoration:none;border-radius:8px">${cta}</a>
  <p style="margin-top:24px;color:#9aa1c4;font-size:12px">Sent by TaskFlow</p>
</div>`;
}

// Fire-and-forget: a mail problem must never break the API request.
export function sendMail({ to, subject, html }) {
  if (!enabled) return;
  fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
    .then(async (res) => {
      if (!res.ok) console.error("Brevo mail failed:", res.status, await res.text());
    })
    .catch((err) => console.error("Brevo mail failed:", err.message));
}

export const inviteMail = ({ to, inviter, boardTitle, url }) =>
  sendMail({
    to,
    subject: `${inviter} added you to "${boardTitle}"`,
    html: layout(
      "You were added to a board",
      `<b>${esc(inviter)}</b> added you to the board <b>${esc(boardTitle)}</b> on TaskFlow.`,
      url,
      "Open board"
    ),
  });

export const assignedMail = ({ to, assigner, cardTitle, boardTitle, url }) =>
  sendMail({
    to,
    subject: `${assigner} assigned you: ${cardTitle}`,
    html: layout(
      "A card was assigned to you",
      `<b>${esc(assigner)}</b> assigned you to <b>${esc(cardTitle)}</b> on <b>${esc(boardTitle)}</b>.`,
      url,
      "Open board"
    ),
  });