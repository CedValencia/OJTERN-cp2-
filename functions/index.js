const { onDocumentUpdated, onDocumentDeleted, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { Resend } = require("resend");
const cloudinary = require("cloudinary").v2;

admin.initializeApp();

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL — migrated off Gmail SMTP (nodemailer `service: "gmail"`) to Resend.
//
// Why the old setup hurt deliverability: sending through smtp.gmail.com with
// a personal/workspace Gmail account as an automated sender runs into
// Google's own sending limits (~500/day) and abuse heuristics for bulk
// automated mail — results ranged from Spam placement to the sending account
// getting throttled or locked outright. It also meant no ability to
// configure our own SPF/DKIM/DMARC, since we didn't control DNS for
// gmail.com.
//
// Resend sends through a verified ojtern.com subdomain with proper
// SPF/DKIM/DMARC (see DNS setup docs), which is what lets Gmail attribute
// the mail to our own domain's reputation instead of a personal inbox's.
//
// RESEND_API_KEY is a Firebase secret (not a plain env var) — same pattern
// already used for the Cloudinary keys below. Set it once with:
//   firebase functions:secrets:set RESEND_API_KEY
const resendApiKey = defineSecret("RESEND_API_KEY");

// These two are plain (non-secret) config — not sensitive, just addresses —
// so they're read straight from env/functions config rather than Secret
// Manager. Set via `firebase functions:config:set` or your deploy env:
//   EMAIL_FROM="OJTern <noreply@ojtern.com>"
//   EMAIL_REPLY_TO="support@ojtern.com"
// Falls back to sensible defaults if unset so local emulation doesn't crash.
const EMAIL_FROM      = process.env.EMAIL_FROM || "OJTern <noreply@ojtern.com>";
const EMAIL_REPLY_TO  = process.env.EMAIL_REPLY_TO || "support@ojtern.com";

// studentPersonalEmails/{email} → { uid }: written by the app when a student
// saves a personal (recovery) email. See requestStudentPasswordReset below.
const STUDENT_PERSONAL_EMAIL_INDEX = "studentPersonalEmails";

// Strips HTML tags for a reasonable plain-text fallback when a caller
// doesn't hand-write one. Good enough for our simple templates (no tables,
// no nested markup) — mail clients that skip HTML rendering still get
// readable text instead of nothing.
const htmlToText = (html) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Shared send helper — every trigger below calls this instead of touching
// the Resend client directly, so From/Reply-To/text-fallback stay consistent
// in one place.
const sendMail = async ({ to, subject, html, text }) => {
  const resend = new Resend(resendApiKey.value());
  const { data, error } = await resend.emails.send({
    from:     EMAIL_FROM,
    to,
    reply_to: EMAIL_REPLY_TO,
    subject,
    html,
    text: text || htmlToText(html),
  });
  if (error) throw new Error(error.message || "Resend send failed");
  return data;
};

// Cloudinary's destroy API requires an authenticated (signed) request — the
// API key/secret must never be exposed to clients, which is why this can't
// be done from CloudinaryService.js in the app itself. Defined as secrets so
// they're not sitting in plaintext functions config; set them once with:
//   firebase functions:secrets:set CLOUDINARY_API_KEY
//   firebase functions:secrets:set CLOUDINARY_API_SECRET
const cloudinaryApiKey    = defineSecret("CLOUDINARY_API_KEY");
const cloudinaryApiSecret = defineSecret("CLOUDINARY_API_SECRET");

// Email right after sign-up, BEFORE any coordinator approval — confirms the
// company's submission actually went through and reached the email they
// typed on Step 1. Fires once, the moment registerCompany
// (AuthService.js) creates the companies/{companyId} doc — separate from
// sendApprovalEmail/sendRejectionEmail below, which only fire later when a
// coordinator changes `status`.
exports.sendRegistrationReceivedEmail = onDocumentCreated(
  { document: "companies/{companyId}", region: "asia-southeast1", secrets: [resendApiKey] },
  async (event) => {
    const company = event.data.data();
    if (!company || !company.email) return;

    const html = `
      <h2>We've Received Your Registration</h2>
      <p>Hi <strong>${company.companyName || "there"}</strong>,</p>
      <p>Thank you for signing up on OJTern! Your company registration has been submitted and is now pending review by our coordinator.</p>
      <p>We'll email you again as soon as a decision is made — no action is needed from you in the meantime.</p>
      <p>Best regards,<br/>OJTern Team</p>
    `;
    const text = `We've Received Your Registration

Hi ${company.companyName || "there"},

Thank you for signing up on OJTern! Your company registration has been submitted and is now pending review by our coordinator.

We'll email you again as soon as a decision is made — no action is needed from you in the meantime.

Best regards,
OJTern Team`;

    try {
      await sendMail({ to: company.email, subject: "OJTern - We've Received Your Registration", html, text });
      console.log(`Registration-received email sent to ${company.email}`);
    } catch (error) {
      console.error("Registration-received email send failed:", error);
    }
  }
);

// Email on company approval
exports.sendApprovalEmail = onDocumentUpdated(
  { document: "companies/{companyId}", region: "asia-southeast1", secrets: [resendApiKey] },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (oldData.status !== "approved" && newData.status === "approved") {
      // The company's Auth account already exists from sign-up (registerCompany
      // creates it up front, before approval) — this doc's ID is that same Auth
      // uid, same as how `coordinators` docs are keyed. So on approval we can
      // generate Firebase's own "verify this email" link for that existing
      // account and drop it into the approval email, instead of a plain sign-in
      // link. Clicking it from Gmail marks emailVerified=true on their account.
      //
      // This is purely a "confirm the inbox is really yours" step — sign-in is
      // NOT gated on it (per product decision), so a company that never clicks
      // it can still sign in normally. If that gate is ever wanted later, check
      // `auth.currentUser.emailVerified` after sign-in on the client.
      // Generating the link can fail (no Auth user for this email, Admin SDK
      // permissions, transient outage). It previously fell back to a bare
      // https://ojtern.com/signin — which produced the worst possible failure
      // mode: a perfectly normal-looking approval email whose Activate button
      // carried no oobCode at all, so clicking it did nothing and the company
      // was told to "activate your account first" forever, with no way out.
      //
      // Now a failure just omits the button and points at the self-service
      // resend instead, so the email is honest about what happened and the
      // company can still recover on its own.
      let verifyUrl = null;
      try {
        verifyUrl = await getAuth().generateEmailVerificationLink(newData.email, {
          url: "https://ojtern.com/signin",
        });
      } catch (error) {
        console.error(
          `ACTIVATION LINK GENERATION FAILED for ${newData.email} — approval email ` +
          `will be sent without an Activate button:`, error
        );
      }

      const ctaHtml = verifyUrl
        ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="background:#8B0000; border-radius:24px;">
              <a href="${verifyUrl}" style="display:inline-block; padding:13px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:24px;">
                Activate
              </a>
            </td>
          </tr>
        </table>`
        : `
        <p>To finish setting up, go to <a href="https://ojtern.com/signin">ojtern.com/signin</a>,
        enter your email, and click <strong>Resend activation link</strong> — we'll email you a
        fresh activation link right away.</p>`;

      const ctaText = verifyUrl
        ? `Activate your account and sign in: ${verifyUrl}`
        : `To finish setting up, go to https://ojtern.com/signin, enter your email, and click "Resend activation link".`;

      const html = `
        <h2>Welcome to OJTern!</h2>
        <p>Hi <strong>${newData.companyName}</strong>,</p>
        <p>Your company registration has been approved by our coordinator.</p>
        <p>You can now:</p>
        <ul>
          <li>Log in to your company dashboard</li>
          <li>Post OJT positions</li>
          <li>View student applications</li>
        </ul>
        ${ctaHtml}
        <p>Best regards,<br/>OJTern Team</p>
      `;
      const text = `Welcome to OJTern!

Hi ${newData.companyName},

Your company registration has been approved by our coordinator. You can now log in to your company dashboard, post OJT positions, and view student applications.

${ctaText}

Best regards,
OJTern Team`;

      try {
        await sendMail({ to: newData.email, subject: "OJTern - Your Registration is Approved", html, text });
        console.log(`Approval email sent to ${newData.email}`);
      } catch (error) {
        console.error("Email send failed:", error);
      }
    }
  }
);

// Email on company rejection
exports.sendRejectionEmail = onDocumentUpdated(
  { document: "companies/{companyId}", region: "asia-southeast1", secrets: [resendApiKey] },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (oldData.status !== "rejected" && newData.status === "rejected") {
      // Coordinators can reject without typing a reason, and the old fallback
      // ("Please contact support.") was the worst thing to show in that case:
      // it reads as an instruction, sends the company chasing a support
      // channel we don't actually staff, and still tells them nothing about
      // what to do next. This fixed line at least names a concrete next step
      // they can take on their own.
      const REASON_NOT_GIVEN =
        "Your registration did not meet the requirements for approval at this time. " +
        "You may submit a new registration with complete and accurate company details.";

      const reason = (newData.rejectionReason || "").trim() || REASON_NOT_GIVEN;

      const html = `
        <h2>Registration Not Approved</h2>
        <p>Hi <strong>${newData.companyName}</strong>,</p>
        <p>Your registration was not approved.</p>
        <p><strong>Reason:</strong> ${reason}</p>
      `;
      const text = `Registration Not Approved

Hi ${newData.companyName},

Your registration was not approved.

Reason: ${reason}`;

      try {
        await sendMail({ to: newData.email, subject: "OJTern - Registration Status Update", html, text });
        console.log(`Rejection email sent to ${newData.email}`);
      } catch (error) {
        console.error("Email send failed:", error);
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION STATUS EMAIL — notifies a student by email whenever a company
// changes their application status (Pending / In Review / To Interview /
// Accepted / Declined — the actual statuses this system uses; see
// STATUS_COLORS in CompanyApplicantsScreen.jsx).
//
// Server-side trigger, same shape as sendApprovalEmail/sendRejectionEmail
// above, for the same reason: the actual status write happens from the
// company's browser (CompanyApplicantsScreen.jsx → handleStatusChange), and
// a client-side "send an email after this write succeeds" call would mean
// either shipping the Resend API key to the frontend, or trusting the
// browser to faithfully report what changed. Comparing before/after here
// instead means the email reflects whatever's actually IN Firestore, not
// what a (possibly tampered-with) client claims happened.
//
// Duplicate-prevention: the one before/after comparison below
// (`oldData.status !== newData.status`) is what actually matters — it's
// what makes a document write to a field OTHER than `status` (e.g. company
// edits `statusNote` without changing `status` itself, or Accepted →
// Accepted from a resubmitted save) a no-op here, regardless of what
// guards exist client-side. The frontend also blocks most of these earlier
// (see the added `newStatus === current?.status` check in
// CompanyApplicantsScreen.jsx), but this is the check that can't be
// bypassed by calling updateDoc() directly.
exports.sendApplicationStatusEmail = onDocumentUpdated(
  { document: "applications/{applicationId}", region: "asia-southeast1", secrets: [resendApiKey] },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (oldData.status === newData.status) return; // nothing actually changed

    const studentId = newData.studentId;
    if (!studentId) {
      console.warn(`Application ${event.params.applicationId} has no studentId — skipping status email.`);
      return;
    }

    // Look up the student's CURRENT registered email fresh from their own
    // doc rather than trusting a possibly-stale copy denormalized onto the
    // application at apply-time — a student may have changed their email
    // since then (see requestEmailChange in AuthService.js on the client
    // side; the same "don't trust a stale denormalized copy" reasoning
    // applies here). Handles Test 5 (no valid email) safely — logs and
    // returns instead of throwing, so a missing/blank email never crashes
    // the trigger or blocks the status change that already succeeded.
    const db = getFirestore();
    let studentEmail = "";
    let studentName  = "Student";
    try {
      const studentSnap = await db.collection("students").doc(studentId).get();
      if (studentSnap.exists) {
        const student = studentSnap.data();
        // personalEmail only: for bulk-created accounts, `email` is the
        // system-generated login address and would bounce (and a bounce puts
        // the address on Resend's suppression list). Every student who can
        // apply has one, since the dashboard requires it before continuing.
        studentEmail = (student.personalEmail || "").trim();
        studentName  = student.fullName
          || [student.firstName, student.lastName].filter(Boolean).join(" ")
          || "Student";
      }
    } catch (err) {
      console.error(`Failed to look up student ${studentId} for status email:`, err);
    }

    if (!studentEmail) {
      console.warn(`Student ${studentId} has no personal email — skipping status email for application ${event.params.applicationId}.`);
      return;
    }

    const companyName = newData.companyName || "the company";
    const newStatus    = newData.status;

    // Same colors CompanyApplicantsScreen.jsx uses for the status badge in
    // the app, so the email visually matches what the student would see
    // after logging in — see STATUS_COLORS there.
    const STATUS_BADGE_COLOR = {
      "Accepted":     "#4CAF50",
      "Declined":     "#8B0000",
      "Pending":      "#C8B800",
      "In Review":    "#1A3A8B",
      "To Interview": "#6B21A8",
    };
    const badgeColor = STATUS_BADGE_COLOR[newStatus] || "#8B0000";

    // Status-specific message — phrasing follows the existing
    // STATUS_NOTIF_TEXT used for the in-app notification (same file), just
    // expanded into full sentences appropriate for an email rather than a
    // short in-app notification line.
    const STATUS_EMAIL_MESSAGE = {
      "Pending":      `Your application to ${companyName} is on file and pending review.`,
      "In Review":    `Your application to ${companyName} is now being reviewed.`,
      "To Interview": `Your application to ${companyName} has moved to the interview stage. Please log in to OJTern to view interview details and any next steps.`,
      "Accepted":     `Congratulations! Your application has been accepted by ${companyName}. Please log in to OJTern to view the details and next steps.`,
      "Declined":     `Your application status has been updated. Unfortunately, your application to ${companyName} was not selected at this time. We encourage you to explore other opportunities available on OJTern.`,
    };
    const statusMessage = STATUS_EMAIL_MESSAGE[newStatus] || `Your application to ${companyName} has been updated to "${newStatus}".`;

    const currentYear = new Date().getFullYear();
    const loginUrl = "https://ojtern.com/signin";
    // Publicly hosted on Cloudinary (same account used for uploads
    // elsewhere in the app — see cloudinary.config below) — a local React
    // asset path (e.g. ../icons/ojtern.png) wouldn't resolve for a mail
    // client reading this HTML outside the app.
    const logoUrl = "https://res.cloudinary.com/doalndt5l/image/upload/v1787477580/ojtern_512_hdruhv.png";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Application Status Update — OJTern</title>
      </head>
      <body style="margin:0; padding:0; background:#f0f0f0; font-family:Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0; padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 18px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(180deg, #A32424 0%, #590101 100%); background-color:#590101; padding:28px 24px; text-align:center;">
                    <img src="${logoUrl}" alt="OJTern" width="56" height="56" style="display:block; margin:0 auto 8px; border-radius:12px;" />
                    <span style="font-family:Arial, Helvetica, sans-serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.03em;">OJTern</span>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 28px 8px;">
                    <h1 style="margin:0 0 18px; font-size:20px; color:#1a1a1a;">Application Status Update</h1>
                    <p style="margin:0 0 16px; font-size:15px; color:#333; line-height:1.6;">
                      Hello, <strong>${studentName}</strong>,
                    </p>
                    <p style="margin:0 0 20px; font-size:15px; color:#333; line-height:1.6;">
                      Your application to <strong>${companyName}</strong> has been updated.
                    </p>

                    <!-- Status badge -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                      <tr>
                        <td style="background:${badgeColor}; border-radius:20px; padding:8px 20px;">
                          <span style="font-size:13px; font-weight:bold; color:#ffffff; letter-spacing:0.04em; text-transform:uppercase;">${newStatus}</span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 26px; font-size:15px; color:#333; line-height:1.6;">
                      ${statusMessage}
                    </p>

                    <!-- CTA -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                      <tr>
                        <td style="background:#8B0000; border-radius:24px;">
                          <a href="${loginUrl}" style="display:inline-block; padding:13px 30px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none;">
                            View My Application
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 28px 28px; border-top:1px solid #eee;">
                    <p style="margin:0 0 4px; font-size:13px; color:#888;">Thank you,<br/>OJTern Team</p>
                    <p style="margin:16px 0 4px; font-size:12px; color:#aaa;">OJTern — Online Job Training and Employment Referral Network</p>
                    <p style="margin:0 0 4px; font-size:11px; color:#bbb;">This is an automated message from OJTern.</p>
                    <p style="margin:0; font-size:11px; color:#bbb;">&copy; ${currentYear} OJTern. All rights reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `Application Status Update — OJTern

Hello, ${studentName},

Your application to ${companyName} has been updated.

New Status: ${newStatus}

${statusMessage}

Log in to view your application: ${loginUrl}

Thank you,
OJTern Team

OJTern — Online Job Training and Employment Referral Network
This is an automated message from OJTern.
© ${currentYear} OJTern. All rights reserved.`;

    try {
      await sendMail({ to: studentEmail, subject: "Application Status Update — OJTern", html, text });
      console.log(`Application status email sent to ${studentEmail} (${oldData.status} → ${newStatus})`);
    } catch (error) {
      // Per spec: a failed email must never roll back the already-saved
      // status change, and must never crash the trigger — just log it.
      console.error(`Failed to send application status email for application ${event.params.applicationId}:`, error);
    }
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION SUBMITTED EMAIL — confirms to the student that their application
// actually reached the company. Fires once, when ApplyModal
// (StudentApplicationScreen.jsx) creates the applications/{applicationId} doc;
// sendApplicationStatusEmail above only fires on LATER status changes, and its
// `oldData.status === newData.status` guard means the initial "Pending" write
// never produces an email there.
//
// Sent to the student's personalEmail (the recovery address they registered at
// first login), falling back to the address typed on the application form. The
// system-generated login address is never used — it bounces, and a bounce puts
// the recipient on Resend's suppression list.
const APPLICATION_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.sendApplicationSubmittedEmail = onDocumentCreated(
  { document: "applications/{applicationId}", region: "asia-southeast1", secrets: [resendApiKey] },
  async (event) => {
    const application = event.data && event.data.data();
    if (!application) return;

    const applicationId = event.params.applicationId;
    const studentId = application.studentId;
    const db = getFirestore();

    let studentEmail = "";
    let studentName  = application.firstName || "Student";

    if (studentId) {
      try {
        const studentSnap = await db.collection("students").doc(studentId).get();
        if (studentSnap.exists) {
          const student = studentSnap.data();
          studentEmail = String(student.personalEmail || "").trim();
          studentName  = student.firstName
            || student.fullName
            || [student.firstName, student.lastName].filter(Boolean).join(" ")
            || studentName;
        }
      } catch (error) {
        console.error(`Failed to look up student ${studentId} for submission email:`, error);
      }
    }

    // Fall back to the address typed on the form itself (ApplyModal pre-fills it
    // with the student's personal email, but they can edit it before sending).
    if (!studentEmail) studentEmail = String(application.email || "").trim();

    if (!studentEmail || !APPLICATION_EMAIL_REGEX.test(studentEmail)) {
      console.warn(`Application ${applicationId} has no usable student email — skipping submission email.`);
      return;
    }

    const companyName = application.companyName || "the company";

    // Position title lives on the post, not on the application; a missing or
    // unreadable post just means the email omits the role line.
    let positionTitle = "";
    if (application.postId) {
      try {
        const postSnap = await db.collection("ojt_posts").doc(application.postId).get();
        if (postSnap.exists) {
          const post = postSnap.data();
          positionTitle = String(post.title || post.position || post.jobTitle || post.role || "").trim();
        }
      } catch (error) {
        console.error(`Failed to look up post ${application.postId} for submission email:`, error);
      }
    }

    const currentYear = new Date().getFullYear();
    const loginUrl = "https://ojtern.com/signin";
    const logoUrl = "https://res.cloudinary.com/doalndt5l/image/upload/v1787477580/ojtern_512_hdruhv.png";
    const positionLineHtml = positionTitle
      ? `<p style="margin:0 0 20px; font-size:15px; color:#333; line-height:1.6;">Position: <strong>${positionTitle}</strong></p>`
      : "";
    const positionLineText = positionTitle ? `Position: ${positionTitle}\n\n` : "";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Application Submitted — OJTern</title>
      </head>
      <body style="margin:0; padding:0; background:#f0f0f0; font-family:Arial, Helvetica, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0; padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 18px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(180deg, #A32424 0%, #590101 100%); background-color:#590101; padding:28px 24px; text-align:center;">
                    <img src="${logoUrl}" alt="OJTern" width="56" height="56" style="display:block; margin:0 auto 8px; border-radius:12px;" />
                    <span style="font-family:Arial, Helvetica, sans-serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.03em;">OJTern</span>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 28px 8px;">
                    <h1 style="margin:0 0 18px; font-size:20px; color:#1a1a1a;">Application Submitted</h1>
                    <p style="margin:0 0 16px; font-size:15px; color:#333; line-height:1.6;">
                      Hello, <strong>${studentName}</strong>,
                    </p>
                    <p style="margin:0 0 16px; font-size:15px; color:#333; line-height:1.6;">
                      Your application to <strong>${companyName}</strong> was submitted successfully and is now waiting for the company to review it.
                    </p>
                    ${positionLineHtml}

                    <!-- Status badge -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                      <tr>
                        <td style="background:#C8B800; border-radius:20px; padding:8px 20px;">
                          <span style="font-size:13px; font-weight:bold; color:#ffffff; letter-spacing:0.04em; text-transform:uppercase;">Pending</span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 26px; font-size:15px; color:#333; line-height:1.6;">
                      We'll email you again as soon as the company updates your application status. No action is needed from you in the meantime.
                    </p>

                    <!-- CTA -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                      <tr>
                        <td style="background:#8B0000; border-radius:24px;">
                          <a href="${loginUrl}" style="display:inline-block; padding:13px 30px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none;">
                            View My Application
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 28px 28px; border-top:1px solid #eee;">
                    <p style="margin:0 0 4px; font-size:13px; color:#888;">Thank you,<br/>OJTern Team</p>
                    <p style="margin:16px 0 4px; font-size:12px; color:#aaa;">OJTern — Online Job Training and Employment Referral Network</p>
                    <p style="margin:0 0 4px; font-size:11px; color:#bbb;">This is an automated message from OJTern.</p>
                    <p style="margin:0; font-size:11px; color:#bbb;">&copy; ${currentYear} OJTern. All rights reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `Application Submitted — OJTern

Hello, ${studentName},

Your application to ${companyName} was submitted successfully and is now waiting for the company to review it.

${positionLineText}Status: Pending

We'll email you again as soon as the company updates your application status. No action is needed from you in the meantime.

Log in to view your application: ${loginUrl}

Thank you,
OJTern Team

OJTern — Online Job Training and Employment Referral Network
This is an automated message from OJTern.
© ${currentYear} OJTern. All rights reserved.`;

    try {
      await sendMail({ to: studentEmail, subject: "Application Submitted — OJTern", html, text });
      console.log(`Application submitted email sent to ${studentEmail} for application ${applicationId}`);
    } catch (error) {
      // Never let a failed email affect the application itself — it's already saved.
      console.error(`Failed to send application submitted email for application ${applicationId}:`, error);
    }
  }
);


exports.deleteStudentAuthOnDocDelete = onDocumentDeleted(
  { document: "students/{studentId}", region: "us-central1" },
  async (event) => {
    const studentId = event.params.studentId;
    const deletedData = event.data.data();

    // Adjust this depending on how you store the Auth UID in the student doc
    const uid = deletedData.uid || studentId;

    try {
      await getAuth().deleteUser(uid);
      console.log(`Deleted Auth account for student: ${uid}`);
    } catch (error) {
      console.error(`Failed to delete Auth account for ${uid}:`, error);
    }

    // Free the deleted student's personal email so it can be registered again.
    const personalEmail = String(deletedData.personalEmail || "").trim().toLowerCase();
    if (personalEmail) {
      try {
        const indexRef = getFirestore().collection(STUDENT_PERSONAL_EMAIL_INDEX).doc(personalEmail);
        const indexSnap = await indexRef.get();
        if (indexSnap.exists && indexSnap.get("uid") === uid) {
          await indexRef.delete();
          console.log(`Released personal email index for student: ${uid}`);
        }
      } catch (error) {
        console.error(`Failed to release personal email index for ${uid}:`, error);
      }
    }
  }
);

// Delete Firebase Auth account when a coordinator document is deleted.
// For the invitation-based Transfer Account flow, this is the ONLY place the
// outgoing coordinator's Auth account gets removed — acceptCoordinatorInvite
// below deletes their Firestore doc using Admin SDK (transfer invites only),
// which fires this trigger as a follow-up step, keeping that function
// focused on the handoff itself.
exports.deleteCoordinatorAuthOnDocDelete = onDocumentDeleted(
  { document: "coordinators/{coordinatorId}", region: "us-central1" },
  async (event) => {
    const coordinatorId = event.params.coordinatorId;
    const deletedData = event.data.data();
    const uid = deletedData.uid || coordinatorId;

    try {
      await getAuth().deleteUser(uid);
      console.log(`Deleted Auth account for coordinator: ${uid}`);
    } catch (error) {
      console.error(`Failed to delete Auth account for ${uid}:`, error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATOR INVITES — invitation-based Transfer Account and Add Account.
// Both flows share one collection (coordinatorInvites) and these three
// functions, distinguished by each invite doc's `type`:
//   - "transfer" — accepting REMOVES the inviting coordinator's account.
//   - "add"      — accepting creates an additional account; the inviting
//     coordinator's own account is left completely untouched.
// ─────────────────────────────────────────────────────────────────────────────

const INVITE_COPY = {
  transfer: {
    subject: "OJTern - You've Been Invited as OJT Coordinator",
    heading: "Coordinator Handoff Invitation",
    body: (invite) => `<strong>${invite.fromName || invite.fromEmail}</strong> is transferring their OJT Coordinator account on OJTern to you.`,
  },
  add: {
    subject: "OJTern - You've Been Invited to Join as OJT Coordinator",
    heading: "Coordinator Invitation",
    body: (invite) => `<strong>${invite.fromName || invite.fromEmail}</strong> is inviting you to join OJTern as an additional OJT Coordinator.`,
  },
};

// Fires when the client creates a coordinatorInvites doc
// (AuthService.js → initiateCoordinatorTransfer / initiateCoordinatorAddition).
// Emails the incoming coordinator an "Accept Invitation" link carrying the
// invite's doc ID + token — same trigger-on-write pattern as
// sendApprovalEmail above. Wording adapts to invite.type.
exports.sendCoordinatorInviteEmail = onDocumentCreated(
  { document: "coordinatorInvites/{inviteId}", region: "asia-southeast1", secrets: [resendApiKey] },
  async (event) => {
    const invite = event.data.data();
    const inviteId = event.params.inviteId;
    if (!invite || invite.status !== "pending") return;

    const copy = INVITE_COPY[invite.type] || INVITE_COPY.add;
    const acceptUrl = `https://ojtern.web.app/accept-invite?id=${inviteId}&token=${invite.token}`;
    const fromWho = invite.fromName || invite.fromEmail;

    const html = `
      <h2>${copy.heading}</h2>
      <p>Hi,</p>
      <p>${copy.body(invite)}</p>
      <p>Click below to accept the invitation and set up your own account:</p>
      <p>
        <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#8B0000;color:#ffffff;text-decoration:none;border-radius:6px;">
          Accept Invitation
        </a>
      </p>
      <p>If you weren't expecting this, you can safely ignore this email — no account will be created unless you click the link above and complete setup.</p>
      <p>Best regards,<br/>OJTern Team</p>
    `;
    const text = `${copy.heading}

Hi,

${fromWho} is ${invite.type === "transfer" ? "transferring their OJT Coordinator account on OJTern to you" : "inviting you to join OJTern as an additional OJT Coordinator"}.

Accept the invitation and set up your account here:
${acceptUrl}

If you weren't expecting this, you can safely ignore this email — no account will be created unless you click the link above and complete setup.

Best regards,
OJTern Team`;

    try {
      await sendMail({ to: invite.toEmail, subject: copy.subject, html, text });
      console.log(`Coordinator invite (${invite.type}) email sent to ${invite.toEmail}`);
    } catch (error) {
      console.error("Coordinator invite email send failed:", error);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY ACTIVATION — self-service resend
// ─────────────────────────────────────────────────────────────────────────────
//
// Firebase action codes are single-use and time-limited, so the link inside
// sendApprovalEmail is one bad outcome away from being useless: it expires, a
// mail scanner prefetches it, the user clicks twice, the URL loses its query
// string somewhere in transit, or link generation failed outright at approval
// time. Every one of those left the company permanently stuck behind "Please
// activate your account first" with a coordinator poking the Firebase console
// as the only recovery. This is that recovery, self-service.
//
// UNAUTHENTICATED BY DESIGN: a company that cannot activate also cannot sign
// in, so requiring auth here would deadlock the exact users this exists for.
// Two consequences follow, and both are handled below —
//   1. The response is always the same regardless of whether the address
//      matched anything, so this can't be used to enumerate registered
//      companies. Real outcomes go to the logs, not the caller.
//   2. There's a per-account cooldown so it can't be used to spam an inbox or
//      burn Resend quota.
const RESEND_ACTIVATION_COOLDOWN_MS = 60 * 1000;

exports.resendCompanyActivation = onCall(
  { region: "asia-southeast1", secrets: [resendApiKey] },
  async (request) => {
    const rawEmail = (request.data && request.data.email) || "";
    const email = String(rawEmail).trim().toLowerCase();

    if (!email) {
      throw new HttpsError("invalid-argument", "Please enter your email address.");
    }

    try {

      // Uniform response — returned on every path below.
      const genericOk = { sent: true };

      const db = getFirestore();
      const snap = await db.collection("companies").where("email", "==", email).limit(1).get();
      if (snap.empty) {
        console.log(`Activation resend requested for unknown email: ${email}`);
        return genericOk;
      }

      const companyRef = snap.docs[0].ref;
      const company    = snap.docs[0].data();

      // Only approved companies have anything to activate. Pending/rejected/
      // suspended/blocked accounts get the same silent OK — signIn already has
      // its own specific message for each of those states.
      if (company.status !== "approved") {
        console.log(`Activation resend skipped for ${email} — status is "${company.status}".`);
        return genericOk;
      }

      const lastSent = company.activationResendAt ? company.activationResendAt.toMillis() : 0;
      if (Date.now() - lastSent < RESEND_ACTIVATION_COOLDOWN_MS) {
        throw new HttpsError(
          "resource-exhausted",
          "We just sent an activation link. Please check your inbox (and spam folder) before requesting another."
        );
      }

      let user;
      try {
        user = await getAuth().getUserByEmail(email);
      } catch (error) {
        console.error(`Activation resend: no Auth user for approved company ${email}:`, error);
        return genericOk;
      }

      // Already verified — nothing to send. Sign-in will work; the company most
      // likely clicked the original link and then hit an unrelated error.
      if (user.emailVerified) {
        console.log(`Activation resend skipped for ${email} — already verified.`);
        return genericOk;
      }

      let verifyUrl;
      try {
        verifyUrl = await getAuth().generateEmailVerificationLink(email, {
          url: "https://ojtern.com/signin",
        });
      } catch (error) {
        console.error(`Activation resend: link generation failed for ${email}:`, error);
        throw new HttpsError(
          "internal",
          "We couldn't generate an activation link right now. Please try again in a few minutes or contact support."
        );
      }
      console.log(`Activation resend: link generated for ${email}, sending mail…`);

      const html = `
        <h2>Activate your OJTern account</h2>
        <p>Hi <strong>${company.companyName || "there"}</strong>,</p>
        <p>Here's a fresh activation link for your company account. This one replaces any earlier link, which may have expired or already been used.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="background:#8B0000; border-radius:24px;">
              <a href="${verifyUrl}" style="display:inline-block; padding:13px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:24px;">
                Activate
              </a>
            </td>
          </tr>
        </table>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>Best regards,<br/>OJTern Team</p>
      `;
      const text = `Activate your OJTern account

Hi ${company.companyName || "there"},

Here's a fresh activation link for your company account. This one replaces any earlier link, which may have expired or already been used.

${verifyUrl}

If you didn't request this, you can safely ignore this email.

Best regards,
OJTern Team`;

      try {
        await sendMail({ to: email, subject: "OJTern - Your Activation Link", html, text });
      } catch (error) {
        // Resend rejects for reasons that are entirely actionable but say
        // nothing useful if they escape as a bare crash: unverified sending
        // domain, per-second rate limit, a recipient on a suppression list
        // after an earlier bounce. Name the failure so the logs point at the
        // real cause instead of just "internal".
        console.error(`Activation resend: Resend rejected the send to ${email}:`, error);
        throw new HttpsError(
          "unavailable",
          "The activation link was generated but the email couldn't be sent. Please try again shortly — if this keeps happening, contact support."
        );
      }

      // Recorded only after a successful send, so a failed send doesn't lock the
      // company out of retrying for the length of the cooldown.
      await companyRef.update({ activationResendAt: FieldValue.serverTimestamp() });

      console.log(`Activation link resent to ${email}`);
      return genericOk;

    } catch (error) {
      // Anything that escapes as a non-HttpsError comes back to the browser as
      // a bare "internal" with no message — the callable protocol has nothing
      // else to send, so the SDK falls back to using the status code as the
      // message. That is exactly the failure this whole flow exists to
      // prevent, so catch it here: log the real stack server-side, and give
      // the caller a message that at least says what stage broke.
      if (error instanceof HttpsError) throw error;
      console.error(`Activation resend: UNHANDLED failure for "${email}":`, error);
      throw new HttpsError("internal", `Activation resend failed: ${error.message || error}`);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT PASSWORD RESET — by personal email.
//
// Bulk-created student accounts sign in with a system-generated address
// (students/{uid}.email) that nobody can receive mail at, so the client SDK's
// sendPasswordResetEmail can't reach them. ForgotPasswordScreen calls this
// alongside AuthService.resetPassword: it finds the student through the
// studentPersonalEmails/{email} → { uid } index (written by the app when the
// student saves a personal email), generates the reset link for the account's
// login address, and mails that link to the personal email instead.
//
// Every path returns the same response, including send failures, so this can't
// be used to find out which emails belong to students. Failures are logged.
const STUDENT_RESET_COOLDOWN_MS = 60 * 1000;
const STUDENT_EMAIL_REGEX = /^[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z]{2,}$/;

exports.requestStudentPasswordReset = onCall(
  { region: "asia-southeast1", secrets: [resendApiKey] },
  async (request) => {
    const rawEmail = (request.data && request.data.email) || "";
    const email = String(rawEmail).trim().toLowerCase();

    if (!email || email.length > 254 || email.includes("..") || !STUDENT_EMAIL_REGEX.test(email)) {
      throw new HttpsError("invalid-argument", "Please enter a valid email address.");
    }

    const genericOk = { sent: true };

    try {
      const db = getFirestore();
      const indexSnap = await db.collection(STUDENT_PERSONAL_EMAIL_INDEX).doc(email).get();
      const uid = indexSnap.exists ? indexSnap.get("uid") : null;
      if (!uid) {
        console.log(`Student reset requested for unregistered personal email: ${email}`);
        return genericOk;
      }

      const studentRef  = db.collection("students").doc(uid);
      const studentSnap = await studentRef.get();
      const student     = studentSnap.exists ? studentSnap.data() : null;

      // The index can outlive a changed email; only the current one counts.
      if (!student || String(student.personalEmail || "").toLowerCase() !== email) {
        console.log(`Student reset skipped for ${email} — no longer the personal email of ${uid}.`);
        return genericOk;
      }

      const lastSent = student.lastPasswordResetRequestAt ? student.lastPasswordResetRequestAt.toMillis() : 0;
      if (Date.now() - lastSent < STUDENT_RESET_COOLDOWN_MS) {
        console.log(`Student reset skipped for ${uid} — within cooldown.`);
        return genericOk;
      }

      let loginEmail;
      try {
        loginEmail = (await getAuth().getUser(uid)).email;
      } catch (error) {
        console.error(`Student reset: no Auth user for student ${uid}:`, error);
        return genericOk;
      }
      if (!loginEmail) {
        console.error(`Student reset: Auth user ${uid} has no login email.`);
        return genericOk;
      }

      let resetUrl;
      try {
        resetUrl = await getAuth().generatePasswordResetLink(loginEmail, {
          url: "https://ojtern.com/signin",
        });
      } catch (error) {
        console.error(`Student reset: link generation failed for ${uid}:`, error);
        return genericOk;
      }

      const name = student.firstName || student.fullName || "there";
      const html = `
        <h2>Reset your OJTern password</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>We received a request to reset the password for your OJTern student account${student.studentId ? ` (Student ID <strong>${student.studentId}</strong>)` : ""}.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="background:#8B0000; border-radius:24px;">
              <a href="${resetUrl}" style="display:inline-block; padding:13px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:24px;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        <p>After resetting, log in with your Student ID and your new password.</p>
        <p>If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p>Best regards,<br/>OJTern Team</p>
      `;
      const text = `Reset your OJTern password

Hi ${name},

We received a request to reset the password for your OJTern student account${student.studentId ? ` (Student ID ${student.studentId})` : ""}.

${resetUrl}

After resetting, log in with your Student ID and your new password.

If you didn't request this, you can safely ignore this email. Your password won't change.

Best regards,
OJTern Team`;

      try {
        await sendMail({ to: email, subject: "OJTern - Reset Your Password", html, text });
      } catch (error) {
        console.error(`Student reset: Resend rejected the send for ${uid}:`, error);
        return genericOk;
      }

      // Recorded only after a successful send, so a failed send doesn't block retrying.
      await studentRef.update({ lastPasswordResetRequestAt: FieldValue.serverTimestamp() });

      console.log(`Student password reset link sent for ${uid}`);
      return genericOk;
    } catch (error) {
      console.error(`Student reset: UNHANDLED failure for "${email}":`, error);
      return genericOk;
    }
  }
);

// Called from the Accept Invitation screen to fetch invite details for
// display (type, fromName, toEmail, deptSelections) — token-validated
// server-side so the coordinatorInvites collection never needs to be
// readable directly by clients via Firestore rules.
exports.getCoordinatorInvite = onCall({ region: "asia-southeast1" }, async (request) => {
  const { inviteId, token } = request.data || {};
  if (!inviteId || !token) {
    throw new HttpsError("invalid-argument", "Missing invite reference.");
  }

  const db = getFirestore();
  const snap = await db.collection("coordinatorInvites").doc(inviteId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "This invitation was not found.");
  }
  const invite = snap.data();

  if (invite.token !== token) {
    throw new HttpsError("permission-denied", "Invalid invitation link.");
  }
  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "This invitation is no longer valid.");
  }

  return {
    type: invite.type || "add",
    fromName: invite.fromName || invite.fromEmail,
    toEmail: invite.toEmail,
    deptSelections: invite.deptSelections || [],
  };
});

// Called from the Accept Invitation screen once the incoming coordinator has
// chosen their own name + password. Runs entirely server-side with Admin SDK
// privileges: creates their Auth account + Firestore profile, marks the
// invite accepted, and — ONLY for type "transfer" — deletes the outgoing
// coordinator's Firestore doc, which cascades into
// deleteCoordinatorAuthOnDocDelete above to clean up their Auth account.
// For type "add", the inviting coordinator's own doc/account is never
// touched.
exports.acceptCoordinatorInvite = onCall({ region: "asia-southeast1" }, async (request) => {
  const { inviteId, token, name, password } = request.data || {};

  if (!inviteId || !token || !name || !password) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (password.length < 8) {
    throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
  }

  const db = getFirestore();
  const inviteRef = db.collection("coordinatorInvites").doc(inviteId);
  const inviteSnap = await inviteRef.get();

  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "This invitation was not found.");
  }
  const invite = inviteSnap.data();

  if (invite.token !== token) {
    throw new HttpsError("permission-denied", "Invalid invitation link.");
  }
  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "This invitation is no longer valid.");
  }

  const normalizedEmail = invite.toEmail;
  const isTransfer = invite.type === "transfer";

  // Double-check the email is still free — it could have been taken between
  // when the invite was created and now.
  const dupSnap = await db.collection("coordinators").where("email", "==", normalizedEmail).get();
  if (!dupSnap.empty) {
    throw new HttpsError("already-exists", "An active account with that email already exists.");
  }

  // Admin SDK user creation doesn't touch any client session — unlike the
  // client SDK's createUserWithEmailAndPassword, nobody gets signed in as
  // this new user as a side effect.
  const newUser = await getAuth().createUser({
    email: normalizedEmail,
    password,
    displayName: name.trim(),
  });

  try {
    await db.collection("coordinators").doc(newUser.uid).set({
      uid: newUser.uid,
      name: name.trim(),
      email: normalizedEmail,
      sex: "",
      contact: "",
      address: "",
      deptSelections: invite.deptSelections || [],
      assignedIndustries: invite.assignedIndustries || [],
      role: "coordinator",
      status: "active",
      passwordChanged: true, // they just chose it themselves during accept
      profileComplete: false,
      // Only meaningful for transfer invites; harmless to record for "add"
      // too as provenance of who invited them.
      transferredFrom: isTransfer ? invite.fromUid : null,
      invitedBy: invite.fromUid,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Roll back the orphaned Auth account if the Firestore write fails.
    await getAuth().deleteUser(newUser.uid).catch(() => {});
    throw new HttpsError("internal", "Failed to create the new coordinator profile.");
  }

  await inviteRef.update({
    status: "accepted",
    acceptedAt: FieldValue.serverTimestamp(),
  });

  if (isTransfer) {
    // Remove the outgoing coordinator's Firestore doc — this fires
    // deleteCoordinatorAuthOnDocDelete above to clean up their Auth account.
    await db.collection("coordinators").doc(invite.fromUid).delete().catch((err) => {
      console.error(`Failed to remove outgoing coordinator doc ${invite.fromUid}:`, err);
    });
  }
  // type "add" — nothing further to do; the inviting coordinator keeps
  // their own account exactly as it was.

  return { uid: newUser.uid };
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT ATTACHMENT CLEANUP — when a message is unsent, its Cloudinary
// file(s) should stop existing, not just stop being shown. unsendMessage
// in useChat.js clears the message's `attachments` field to null as part of
// the same write that sets `unsent: true` — this trigger reads the
// PRE-update (`before`) attachments off that write and deletes each one
// from Cloudinary. Runs after the fact (fire-and-forget from the client's
// point of view); a failure here just leaves an orphaned file in Cloudinary,
// it doesn't affect anything the user sees.
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteUnsentAttachments = onDocumentUpdated(
  {
    document: "conversations/{convId}/messages/{msgId}",
    region: "asia-southeast1",
    secrets: [cloudinaryApiKey, cloudinaryApiSecret],
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // Only act on the specific transition unsendMessage performs: wasn't
    // unsent before, is unsent now, and there were attachments to clean up.
    // (Guards against re-running on later unrelated edits to the same doc,
    // since by then `before.attachments` will already be null.)
    if (before.unsent || !after.unsent) return;
    const attachments = before.attachments || (before.attachment ? [before.attachment] : []);
    if (attachments.length === 0) return;

    cloudinary.config({
      cloud_name: "doalndt5l", // matches CLOUDINARY_CLOUD_NAME in CloudinaryService.js
      api_key:    cloudinaryApiKey.value(),
      api_secret: cloudinaryApiSecret.value(),
    });

    for (const att of attachments) {
      // Attachments sent before this feature shipped won't have a publicId —
      // nothing to do for those, they're just orphaned in Cloudinary already.
      if (!att.publicId) {
        console.warn(`Skipping Cloudinary cleanup — no publicId on attachment "${att.name}"`);
        continue;
      }
      try {
        await cloudinary.uploader.destroy(att.publicId, {
          resource_type: att.resourceType || "image",
        });
        console.log(`Deleted Cloudinary asset ${att.publicId}`);
      } catch (error) {
        console.error(`Failed to delete Cloudinary asset ${att.publicId}:`, error);
      }
    }
  }
);