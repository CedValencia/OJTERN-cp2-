const { onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Email on company approval
exports.sendApprovalEmail = onDocumentUpdated(
  { document: "companies/{companyId}", region: "asia-southeast1" },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (oldData.status !== "approved" && newData.status === "approved") {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: newData.email,
        subject: "OJTern - Your Registration is Approved! ✅",
        html: `
          <h2>Welcome to OJTern!</h2>
          <p>Hi <strong>${newData.companyName}</strong>,</p>
          <p>Your company registration has been <strong>APPROVED</strong> by our coordinator.</p>
          <p>You can now:</p>
          <ul>
            <li>Log in to your company dashboard</li>
            <li>Post OJT positions</li>
            <li>View student applications</li>
          </ul>
          <p><a href="https://ojtern.app/login">Click here to sign in</a></p>
          <br/>
          <p>Best regards,<br/>OJTern Team</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Approval email sent to ${newData.email}`);
      } catch (error) {
        console.error("Email send failed:", error);
      }
    }
  }
);

// Email on company rejection
exports.sendRejectionEmail = onDocumentUpdated(
  { document: "companies/{companyId}", region: "asia-southeast1" },
  async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (oldData.status !== "rejected" && newData.status === "rejected") {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: newData.email,
        subject: "OJTern - Registration Status Update",
        html: `
          <h2>Registration Not Approved</h2>
          <p>Hi <strong>${newData.companyName}</strong>,</p>
          <p>Your registration was not approved.</p>
          <p><strong>Reason:</strong> ${newData.rejectionReason || "Please contact support."}</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Rejection email sent to ${newData.email}`);
      } catch (error) {
        console.error("Email send failed:", error);
      }
    }
  }
);

// Delete Firebase Auth account when student document is deleted
exports.deleteStudentAuthOnDocDelete = onDocumentDeleted(
  { document: "students/{studentId}", region: "us-central1" },
  async (event) => {
    const studentId = event.params.studentId;
    const deletedData = event.data.data();

    // Adjust this depending on how you store the Auth UID in the student doc
    const uid = deletedData.uid || studentId;

    try {
      await admin.auth().deleteUser(uid);
      console.log(`Deleted Auth account for student: ${uid}`);
    } catch (error) {
      console.error(`Failed to delete Auth account for ${uid}:`, error);
    }
  }
);