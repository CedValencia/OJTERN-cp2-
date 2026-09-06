import React, { useState, useRef, useEffect } from "react";
import { registerCompany } from "./AuthService";
import { uploadFiles }    from "./CloudinaryService";
import { color, font, type, space, radius, shadow } from "./theme";

// ── Responsive Styles ─────────────────────────────────────────────────────────
const ResponsiveStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
 
    /* ── Outer wrapper ── */
    .su2-wrapper {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
    }
    @media (max-width: 480px) {
      .su2-wrapper { padding: 10px; }
    }
 
 
    /* ── Panel (single full-bleed dark card — no separate header bar) ── */
    .su2-panel {
      background: ${color.blush100};
      border-radius: 26px;
      overflow: hidden;
      position: relative;   /* kailangan ng mga modal sa loob */
    }
    @media (max-width: 480px) {
      .su2-panel {
        padding: ${space.lg} ${space.md};
        border-radius: 20px;
        height: 580px;
        max-height: 100%;
      }
    }
 
    /* ── Scrollable middle section (notice, dropzone, file list) ── */
    .su2-panel-scroll {
      padding: 32px 26px 30px;
      height: 64vh;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }
    .su2-panel-scroll > * { flex-shrink: 0; }
 
    /* ── Fixed footer section (checkbox, buttons, sign-in) ── */
    .su2-panel-footer {
      margin-top: auto;
    }
    .su2-step-label {
      font-family: ${font.ui};
      font-size: ${type.helper.fontSize};
      color: ${color.onWineMuted};
      text-align: center;
      margin: 0 0 4px;
    }
    .su2-panel-title {
      font-family: ${font.ui};
      font-size: 1.3rem;
      font-weight: 700;
      color: ${color.onWine};
      text-align: center;
      margin: 0 0 ${space.md};
    }
    .su2-panel-divider {
      border: none;
      border-top: 1px solid ${color.onWineFaint};
      margin-bottom: ${space.lg};
    }
 
    /* ── Section label (bold white text above each white sub-panel) ── */
    .su2-field-label {
      font-family: ${font.ui};
      font-size: ${type.label.fontSize};
      font-weight: ${type.label.fontWeight};
      color: ${color.onWine};
      margin-bottom: 8px;
    }
 
    /* ── Notice banner (white sub-panel, sits on the dark card) ── */
    .su2-notice {
      background: ${color.wine600};
      border-left: 3px solid ${color.warning};
      border-radius: 16px;
      padding: 12px 16px;
      margin-bottom: ${space.md};
    }
 
    /* ── Drop zone (white sub-panel) ── */
    .su2-dropzone {
      background: ${color.wine600};
      border-radius: 16px;
      padding: 20px 16px;
      text-align: center;
      margin-bottom: ${space.sm};
      transition: all 0.2s;
    }
    @media (max-width: 400px) {
      .su2-dropzone { padding: 14px 10px; }
    }
 
    /* ── File list modal overlay ── */
    .su2-modal-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 999;
      border-radius: ${radius.panel};
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }
 
    .su2-modal-inner {
      background: ${color.wine600};
      border-radius: ${radius.card};
      width: 90%;
      max-width: 320px;
      max-height: 88%;
      overflow-y: auto;
      padding: ${space.md};
      box-shadow: ${shadow.panel};
    }
    @media (max-width: 360px) {
      .su2-modal-inner { padding: 12px; width: 95%; }
    }
 
    /* ── Bottom action row (Back + Submit side by side) ── */
    .su2-action-row-flex {
      display: flex;
      gap: 12px;
      margin-bottom: ${space.sm};
    }
 
    .su2-action-row-flex .su2-btn {
      flex: 1 1 auto;
      width: auto;
    }
 
    /* ── Action buttons ── */
    .su2-btn {
      background: ${color.wine600};
      color: ${color.ink};
      border: none;
      border-radius: ${radius.pill};
      padding: 14px 32px;
      font-family: ${font.ui};
      font-size: ${type.control.fontSize};
      font-weight: 700;
      letter-spacing: 0.01em;
      cursor: pointer;
      box-shadow: ${shadow.pill};
      width: 100%;
    }
 
      .su2-btn:hover:not(:disabled) {
      background: #898989;
      color: ${color.onWine};
    }
 
    /* ── Back button — gray by default, white bg / black text on hover ── */
    .su2-btn-back {
      background: #6f6f6f;
      color: #ffffff;
      border: none;
      border-radius: ${radius.pill};
      padding: 14px 28px;
      font-family: ${font.ui};
      font-size: ${type.control.fontSize};
      font-weight: 700;
      letter-spacing: 0.01em;
      cursor: pointer;
      box-shadow: ${shadow.pill};
      flex: 0 0 auto;
      transition: background 0.2s, color 0.2s;
    }
    .su2-btn-back:hover:not(:disabled) {
      background: #ffffff;
      color: #000000;
    }
 
    /* ── File row ── */
    .su2-file-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${color.wine800};
      border-radius: 8px;
      padding: 8px 12px;
      border: 1px solid ${color.wine400};
    }
    .su2-file-name {
      font-family: ${font.ui};
      font-size: ${type.helper.fontSize};
      color: ${color.inkBody};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 80%;
    }
    @media (max-width: 360px) {
      .su2-file-name { font-size: 0.72rem; }
    }
 
    /* ── Terms & Conditions modal ── */
    .su2-terms-inner {
      background: ${color.wine600};
      border-radius: ${radius.card};
      width: 92%;
      max-width: 520px;
      max-height: 88%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    @media (max-width: 360px) {
      .su2-terms-inner { width: 92%; max-height: 85%; }
    }
 
    .su2-terms-header {
      padding: 12px 16px;
      border-bottom: 1px solid ${color.wine400};
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
 
    .su2-terms-scroll {
      padding: 14px 16px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1 1 auto;
    }
 
    @media (max-width: 360px) {
      .su2-terms-scroll {
        padding: 10px 12px;
      }
    }
 
    /* ── Main headings ── */
    .su2-terms-scroll h2 {
      font-family: ${font.ui};
      font-size: 1.05rem;
      font-weight: 700;
      color: ${color.ink};
      line-height: 1.4;
      margin: 14px 0 10px;
    }
 
    .su2-terms-scroll h2:first-child {
      margin-top: 0;
    }
 
    /* ── Numbered sections: 1., 2., 3., etc. ── */
    .su2-terms-scroll h3 {
      font-family: ${font.ui};
      font-size: 0.84rem;
      font-weight: 700;
      color: ${color.ink};
      line-height: 1.45;
      margin: 12px 0 5px;
    }
 
    .su2-terms-scroll h3:first-child {
      margin-top: 0;
    }
 
    /* ── Subsections: 3.1, 3.2, etc. ── */
    .su2-terms-scroll h4 {
      font-family: ${font.ui};
      font-size: 0.78rem;
      font-weight: 700;
      color: ${color.ink};
      line-height: 1.45;
      margin: 10px 0 4px;
    }
 
    /* ── Body content ── */
    .su2-terms-scroll p {
      font-family: ${font.ui};
      font-size: 0.73rem;
      font-weight: 400;
      color: ${color.inkBody};
      line-height: 1.6;
      margin: 0 0 8px;
    }
 
    /* ── Lists ── */
    .su2-terms-scroll ul {
      margin: 2px 0 9px;
      padding-left: 20px;
    }
 
    .su2-terms-scroll li {
      font-family: ${font.ui};
      font-size: 0.73rem;
      font-weight: 400;
      color: ${color.inkBody};
      line-height: 1.55;
      margin-bottom: 4px;
    }
 
    /* ── Effective Date / Version ── */
    .su2-terms-scroll .su2-terms-meta {
      font-family: ${font.ui};
      font-size: 0.68rem;
      font-weight: 400;
      color: ${color.inkBody};
      line-height: 1.4;
      margin: 0 0 3px;
    }
 
    /* ── Horizontal divider ── */
    .su2-terms-scroll .su2-terms-rule {
      border: none;
      border-top: 1px solid ${color.wine400};
      margin: 12px 0;
    }
 
    /* ── Footer ── */
    .su2-terms-footer {
      padding: 10px 16px;
      border-top: 1px solid ${color.wine400};
      flex-shrink: 0;
      background: ${color.wine600};
    }
  `}</style>
);

// ── Terms & Conditions content (placeholder — replace with OJTern's actual policy) ──
const TermsContent = () => (
<> <p className="su2-terms-meta">Effective Date: October 10, 2026</p> <p className="su2-terms-meta">Version: Version 1.0</p> <hr className="su2-terms-rule" />
 
 
 
<h2>Terms &amp; Conditions</h2>
 
<h3>1. Acceptance of Terms</h3>
<p>
  These Terms &amp; Conditions govern the access and use of OJTern, an OJT Finder and coordination platform developed to support the On-the-Job Training (OJT), internship, placement, coordination, and monitoring activities of Dominican College of Tarlac, Inc. (DCT), by Companies, Organizations, Corporations, Agencies, and other OJT Partners ("Company Users").
</p>
<p>
  By creating, accessing, or using a Company account on OJTern, you acknowledge that you have read, understood, and agreed to comply with these Terms &amp; Conditions, the Privacy Policy, applicable DCT policies, OJT requirements, and other applicable rules governing the use of the platform.
</p>
<p>
  OJTern shall only be used for legitimate OJT, internship, placement, recruitment, coordination, communication, and other authorized purposes related to OJT activities.
</p>
 
<h3>2. Company Account Registration</h3>
<p>
  Companies, Organizations, Corporations, Agencies, and other OJT Partners shall create their own accounts through the OJTern self-registration process.
</p>
<p>
  During registration, you may be required to provide accurate and complete information, including:
</p>
<ul>
  <li>Company or Organization Name;</li>
  <li>Industry;</li>
  <li>Business or Organization Location;</li>
  <li>Authorized contact information;</li>
  <li>Account credentials; and</li>
  <li>Registration, verification, or supporting documents.</li>
</ul>
<p>
  You are responsible for ensuring that the information submitted during registration remains accurate and updated.
</p>
<p>
  Self-registration does not automatically constitute approval or verification. Your account shall remain subject to the applicable Company verification process.
</p>
 
<h3>3. Company Verification</h3>
<p>
  To establish the legitimacy of your organization and ensure the reliability of OJT opportunities posted on the platform, you may be required to submit valid registration, permit, license, or other supporting documents.
</p>
<p>Depending on the nature of your organization, these documents may include:</p>
<ul>
  <li>Department of Trade and Industry (DTI) registration;</li>
  <li>Securities and Exchange Commission (SEC) registration;</li>
  <li>Cooperative Development Authority (CDA) registration;</li>
  <li>Bureau of Internal Revenue (BIR) documents;</li>
  <li>Business or Mayor's Permit;</li>
  <li>Relevant licenses or permits; and</li>
  <li>Other appropriate government-issued registration or supporting documents.</li>
</ul>
 
<h4>3.1 Restricted Access to Verification Documents</h4>
<p>
  Verification documents submitted through OJTern shall be treated as confidential information.
</p>
<p>
  <strong>Only the respective DCT OJT Coordinator(s) who are authorized and assigned to verify or manage your Company account shall have access to your submitted verification documents.</strong>
</p>
<p>
  Your verification documents shall not be accessible to Students, other Companies or OJT Partners, unauthorized personnel, or other individuals who are not authorized to perform the relevant verification or administrative function.
</p>
<p>
  Authorized personnel shall only access your verification documents when necessary for legitimate verification, OJT administration, compliance, security, or other authorized institutional purposes.
</p>
<p>
  Verification documents shall not be publicly displayed, unnecessarily copied, downloaded, distributed, disclosed, or used for personal, commercial, or unrelated purposes.
</p>
 
<h4>3.2 Verification Status</h4>
<p>
  After review, your Company or OJT Partner account may receive one of the following statuses:
</p>
<ul>
  <li><strong>Approved</strong> — the submitted information and documents have satisfactorily met the applicable verification requirements;</li>
  <li><strong>Declined</strong> — the submitted information or documents do not meet the applicable verification requirements; or</li>
  <li><strong>For Revision / Additional Documents Required</strong> — additional information or documentation is required before verification can be completed.</li>
</ul>
<p>
  Submission of false, fraudulent, altered, expired, or invalid documents may result in rejection, restriction, suspension, or termination of your account and may be referred to appropriate authorities where legally permitted.
</p>
 
<h3>4. Use of the Platform</h3>
<p>As a Company or OJT Partner, you may use OJTern to:</p>
<ul>
  <li>Create and manage your Company account;</li>
  <li>Post legitimate OJT opportunities;</li>
  <li>Provide information regarding available OJT positions;</li>
  <li>Communicate with Students and authorized DCT OJT Coordinators;</li>
  <li>Review applications submitted to your organization;</li>
  <li>Manage appropriate OJT placement activities; and</li>
  <li>Provide accurate and updated information regarding your organization.</li>
</ul>
<p>
  You shall use OJTern only for legitimate OJT-related purposes and shall comply with applicable DCT OJT requirements and policies.
</p>
 
<h3>5. Company Responsibilities</h3>
<p>As a Company or OJT Partner, you are responsible for:</p>
<ul>
  <li>Creating and maintaining your own account;</li>
  <li>Providing accurate, complete, and legitimate information;</li>
  <li>Completing applicable verification requirements;</li>
  <li>Providing legitimate and appropriate OJT opportunities;</li>
  <li>Maintaining accurate information about available OJT positions;</li>
  <li>Providing a professional and appropriate environment for Students;</li>
  <li>Treating Students fairly and professionally;</li>
  <li>Protecting Student information made available to your organization; and</li>
  <li>Complying with applicable DCT OJT requirements, policies, and Philippine laws.</li>
</ul>
 
<h3>6. Prohibited Activities</h3>
<p>You shall not:</p>
<ul>
  <li>Provide false, misleading, fraudulent, altered, or unauthorized information or documents;</li>
  <li>Impersonate another person, Company, Organization, Corporation, Agency, or OJT Partner;</li>
  <li>Share your account credentials with unauthorized individuals;</li>
  <li>Access another User's account without authorization;</li>
  <li>Harass, threaten, exploit, discriminate against, or improperly treat Students or other Users;</li>
  <li>Collect, copy, disclose, sell, distribute, or otherwise process personal information without lawful authority;</li>
  <li>Create or publish false, fraudulent, misleading, or unrelated OJT opportunities;</li>
  <li>Attempt to bypass or interfere with the Company verification process;</li>
  <li>Attempt to access verification documents belonging to another Company or OJT Partner;</li>
  <li>Use Student information for personal, commercial, marketing, or unrelated purposes without lawful authority;</li>
  <li>Sell or commercially exploit personal information obtained through OJTern;</li>
  <li>Attempt to compromise OJTern's security or operation; or</li>
  <li>Use OJTern for unlawful, fraudulent, or unauthorized activities.</li>
</ul>
<p>
  Violations may result in account restriction, suspension, deactivation, termination, or other appropriate administrative or legal action.
</p>
 
<h3>7. Account Security</h3>
<p>
  You are responsible for maintaining the confidentiality and security of your Company account credentials.
</p>
<p>You shall:</p>
<ul>
  <li>Keep your password and authentication information confidential;</li>
  <li>Not intentionally provide your account credentials to unauthorized individuals;</li>
  <li>Use reasonable security practices to protect your account;</li>
  <li>Change your password when unauthorized access or compromise is suspected; and</li>
  <li>Promptly report suspected unauthorized access or security incidents to the appropriate OJTern administrator.</li>
</ul>
<p>
  The OJTern Head or System Administrator may restrict, suspend, deactivate, or terminate your account when necessary due to security concerns, misuse, violation of these Terms, or other legitimate administrative reasons.
</p>
 
<h3>8. Personal Information and Confidentiality</h3>
<p>
  During your use of OJTern, you may receive or access personal information belonging to Students or other individuals for legitimate OJT-related purposes.
</p>
<p>
  You shall keep such information confidential and shall only collect, access, use, store, or disclose it when necessary and legally permitted for legitimate OJT-related purposes.
</p>
<p>
  You shall not sell, rent, trade, distribute, disclose, or commercially exploit personal information obtained through OJTern.
</p>
<p>
  You shall also protect any confidential Company, institutional, or OJT-related information that you receive through the platform.
</p>
 
<h3>9. Third-Party Services and Data Processing</h3>
<p>
  OJTern may use authorized third-party service providers to support necessary technical and operational functions, including cloud storage, authentication, hosting, database services, system maintenance, security, communication, and related services.
</p>
<p>
  Where third-party service providers process personal information on behalf of OJTern, such processing shall be limited to authorized and legitimate purposes and shall be subject to appropriate privacy, confidentiality, and security safeguards.
</p>
<p>
  OJTern shall not authorize third-party service providers to sell, rent, trade, or commercially exploit personal information obtained through OJTern.
</p>
 
<h3>10. Prohibition on Sale of Personal Information</h3>
<p>
  OJTern shall not sell, rent, trade, or commercially exploit your personal information or the personal information of Students and other individuals processed through the platform.
</p>
<p>
  OJTern shall not provide personal information to third parties for the purpose of selling, renting, trading, or commercially exploiting such information.
</p>
<p>
  As a Company User, you are likewise prohibited from selling, renting, trading, or commercially exploiting personal information obtained through OJTern.
</p>
<p>
  Any processing, sharing, disclosure, or transfer of personal information must have a legitimate and lawful purpose and must comply with <strong>Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012</strong>, its Implementing Rules and Regulations, and applicable issuances of the National Privacy Commission (NPC).
</p>
 
<h3>11. Compliance with the Data Privacy Act of 2012</h3>
<p>
  OJTern is committed to protecting personal information in accordance with <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>, its Implementing Rules and Regulations, and applicable National Privacy Commission issuances.
</p>
<p>
  The processing of personal information through OJTern shall observe the principles of transparency, legitimate purpose, and proportionality and shall be subject to appropriate security and confidentiality measures.
</p>
<p>
  Company Users shall likewise comply with applicable data privacy requirements when accessing or processing Student or other personal information through OJTern.
</p>
 
<h3>12. Changes to These Terms</h3>
<p>
  OJTern may update these Terms &amp; Conditions when necessary due to changes in system functionality, institutional policies, applicable laws, regulations, privacy requirements, or operational procedures.
</p>
<p>
  You may be notified of significant changes through appropriate means. Continued use of your OJTern account after the effective date of revised Terms may constitute acceptance of the updated Terms, subject to applicable requirements.
</p>
 
<h3>13. Contact</h3>
<p>
  For questions, concerns, or requests regarding these Terms &amp; Conditions, you may contact:
</p>
<p style={{ fontFamily: font.ui, color: color.ink }}>
  Email: ojtern@gmail.com
</p>
<p style={{ fontFamily: font.ui, color: color.ink, marginBottom: 0 }}>
  School Address: Dominican College of Tarlac, Inc., College of Computer Studies,
  McArthur Highway, Poblacion (Sto. Rosario), Capas, Tarlac, Philippines
</p>
 
<hr className="su2-terms-rule" />
 
<h2>Privacy Policy</h2>
 
<h3>1. Introduction</h3>
<p>
  This Privacy Policy explains how OJTern collects, uses, stores, protects, retains, shares, and otherwise processes information relating to Companies, Organizations, Corporations, Agencies, and other OJT Partners ("Company Users").
</p>
<p>
  OJTern is committed to protecting the privacy and security of Company User information and any personal information processed through the platform.
</p>
<p>
  OJTern shall process personal information in accordance with <strong>Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012</strong>, its Implementing Rules and Regulations, applicable National Privacy Commission issuances, and relevant DCT policies.
</p>
 
<h3>2. Account Creation and Personal Information Processing</h3>
<p>
  Companies, Organizations, Corporations, Agencies, and other OJT Partners create their own accounts through the OJTern self-registration process.
</p>
<p>
  Information provided during registration may be processed for:
</p>
<ul>
  <li>Account creation and authentication;</li>
  <li>Organization identification;</li>
  <li>Communication;</li>
  <li>Industry and location identification;</li>
  <li>Company verification;</li>
  <li>Evaluation and validation;</li>
  <li>Management of legitimate OJT opportunities; and</li>
  <li>Other legitimate OJT-related purposes.</li>
</ul>
<p>
  Self-registration does not automatically constitute approval or verification.
</p>
 
<h3>3. Information We Collect</h3>
<p>OJTern may collect information necessary for Company account and OJT administration, including:</p>
<ul>
  <li>Company or Organization Name;</li>
  <li>Industry;</li>
  <li>Business or Organization Location;</li>
  <li>Authorized contact information;</li>
  <li>OJT opportunity information;</li>
  <li>Account and authentication information;</li>
  <li>Registration and verification documents; and</li>
  <li>Other information reasonably necessary for Company verification and legitimate OJT activities.</li>
</ul>
 
<h3>4. Company Verification Documents</h3>
<p>
  Companies and OJT Partners may be required to submit registration documents, permits, licenses, or other supporting documentation to establish the legitimacy of their organization.
</p>
<p>
  These documents may include DTI registration, SEC registration, CDA registration, BIR documents, Business or Mayor's Permit, relevant licenses, or other appropriate government-issued supporting documents.
</p>
 
<h4>4.1 Restricted Access and Confidentiality</h4>
<p>
  Verification documents submitted by your Company shall be treated as confidential information.
</p>
<p>
  <strong>Only the respective DCT OJT Coordinator(s) who are authorized and assigned to verify or manage your Company account shall have access to these verification documents.</strong>
</p>
<p>
  Students, other Companies or OJT Partners, unauthorized personnel, and unrelated individuals shall not have access to your verification documents.
</p>
<p>
  Authorized personnel shall only access your verification documents when necessary for legitimate verification, OJT administration, compliance, security, or other authorized institutional purposes.
</p>
<p>
  This restricted-access measure is intended to help ensure the <strong>security, confidentiality, and proper handling</strong> of your Company's verification information.
</p>
 
<h3>5. Purpose of Collection and Processing</h3>
<p>
  OJTern may collect and process Company information for:
</p>
<ul>
  <li>Creating and managing your Company account;</li>
  <li>Authenticating and identifying your organization;</li>
  <li>Verifying the legitimacy of your organization;</li>
  <li>Reviewing and managing OJT opportunities;</li>
  <li>Facilitating communication with Students and authorized Coordinators;</li>
  <li>Supporting OJT applications and placement activities;</li>
  <li>Maintaining necessary OJT and institutional records;</li>
  <li>Maintaining system security and accountability; and</li>
  <li>Complying with applicable laws, regulations, and institutional policies.</li>
</ul>
<p>
  Personal information shall not be collected or processed beyond what is reasonably necessary for legitimate purposes.
</p>
 
<h3>6. Legal Basis and Compliance with Republic Act No. 10173</h3>
<p>
  OJTern shall process personal information only when there is an applicable lawful basis and only for specified and legitimate purposes in accordance with <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>, its Implementing Rules and Regulations, and applicable National Privacy Commission issuances.
</p>
<p>
  OJTern shall observe the principles of transparency, legitimate purpose, and proportionality in the collection and processing of personal information.
</p>
 
<h3>7. Data Privacy Principles</h3>
 
<h4>7.1 Transparency</h4>
<p>
  You shall be informed about how your personal information is collected, processed, stored, shared, and protected.
</p>
 
<h4>7.2 Legitimate Purpose</h4>
<p>
  Personal information shall only be processed for lawful, specified, and legitimate purposes related to OJTern's authorized functions.
</p>
 
<h4>7.3 Proportionality</h4>
<p>
  Personal information collected and processed shall be adequate, relevant, and not excessive in relation to the purposes for which it is processed.
</p>
 
<h4>7.4 Security</h4>
<p>
  Reasonable and appropriate organizational, physical, and technical measures shall be implemented to protect personal information against unauthorized access, disclosure, alteration, loss, destruction, or other unauthorized processing.
</p>
 
<h3>8. Access to Company Information</h3>
<p>
  Your Company information may be accessed by authorized personnel when necessary to perform legitimate OJTern functions.
</p>
<p>
  Access to your Company's verification documents shall remain restricted to the <strong>respective DCT OJT Coordinator(s) authorized and assigned to verify or manage your Company account</strong>.
</p>
<p>
  Other Companies, Students, and unauthorized personnel shall not have access to your verification documents.
</p>
 
<h3>9. Confidentiality</h3>
<p>
  OJTern shall take reasonable measures to maintain the confidentiality of Company information and verification documents.
</p>
<p>
  Authorized personnel who have access to your information shall only use such information for legitimate and authorized purposes.
</p>
<p>
  Your verification documents shall not be publicly displayed, unnecessarily copied, distributed, disclosed, sold, or commercially exploited.
</p>
 
<h3>10. Security Measures</h3>
<p>
  OJTern shall implement reasonable and appropriate organizational, physical, and technical security measures designed to protect Company information and personal information against unauthorized access, disclosure, alteration, loss, destruction, or other unauthorized processing.
</p>
<p>
  These measures may include role-based access controls, authentication mechanisms, restricted administrative access, confidentiality requirements, secure storage mechanisms, and security controls for authorized third-party services.
</p>
 
<h3>11. Third-Party Service Providers and Data Processing</h3>
<p>
  OJTern may use authorized third-party service providers for necessary technical and operational functions, including cloud storage, hosting, authentication, database management, system maintenance, security, communication, and related services.
</p>
<p>
  Where personal information is processed by an authorized third-party service provider on behalf of OJTern, the processing shall be limited to authorized and legitimate purposes and shall be subject to appropriate privacy, confidentiality, and security safeguards.
</p>
<p>
  OJTern shall not authorize third-party service providers to sell, rent, trade, or commercially exploit your personal information.
</p>
 
<h3>12. Prohibition on Selling Personal Information</h3>
<p>
  <strong>OJTern shall not sell, rent, trade, or commercially exploit your personal information.</strong>
</p>
<p>
  OJTern shall not provide your personal information to third parties for the purpose of selling, renting, trading, or commercially exploiting such information.
</p>
<p>
  Personal information may only be shared, disclosed, or processed when necessary for a legitimate and lawful purpose and in accordance with applicable data privacy requirements.
</p>
<p>
  Company Users are likewise prohibited from selling, renting, trading, distributing, or commercially exploiting personal information obtained through OJTern without lawful authority.
</p>
 
<h3>13. Sharing and Disclosure of Information</h3>
<p>
  Your Company information may be shared or disclosed only when reasonably necessary and legally permitted, including for:
</p>
<ul>
  <li>Company verification and validation;</li>
  <li>Legitimate OJT coordination and placement activities;</li>
  <li>Communication with authorized DCT personnel;</li>
  <li>Authorized technical and service providers;</li>
  <li>Compliance with legal or regulatory requirements; or</li>
  <li>Other legitimate purposes permitted under applicable law.</li>
</ul>
<p>
  Your verification documents shall not be routinely shared with Students, other Companies or OJT Partners, unauthorized personnel, or unrelated third parties.
</p>
 
<h3>14. Data Retention and Disposal</h3>
<p>
  Company information and verification documents shall be retained only for as long as reasonably necessary to fulfill the legitimate purposes for which they were collected, comply with applicable legal or institutional requirements, maintain necessary OJT records, or address legitimate security or administrative requirements.
</p>
<p>
  When information is no longer required, it shall be securely deleted, disposed of, or otherwise rendered inaccessible in accordance with applicable retention and disposal procedures.
</p>
 
<h3>15. Security Incidents and Data Breaches</h3>
<p>
  OJTern shall take reasonable steps to detect, investigate, contain, mitigate, and address suspected security incidents involving personal or confidential information.
</p>
<p>
  Where notification is required under applicable law or regulation, OJTern shall undertake the appropriate notification and response procedures.
</p>
 
<h3>16. Rights of Data Subjects</h3>
<p>
  Subject to applicable laws and regulations, you may have rights concerning your personal information, including:
</p>
<ul>
  <li>The right to be informed;</li>
  <li>The right to access;</li>
  <li>The right to dispute inaccurate or erroneous information;</li>
  <li>The right to object, where applicable;</li>
  <li>The right to request blocking, removal, or destruction where applicable;</li>
  <li>The right to data portability, where applicable; and</li>
  <li>The right to lodge a complaint before the National Privacy Commission, subject to applicable procedures and requirements.</li>
</ul>
 
<h3>17. Responsibilities Regarding Personal Information</h3>
<p>
  As a Company User, you shall handle personal information obtained through OJTern responsibly and in accordance with applicable privacy requirements.
</p>
<p>You shall not:</p>
<ul>
  <li>Access personal information without authorization;</li>
  <li>Access verification documents belonging to another Company or OJT Partner;</li>
  <li>Copy or download confidential information unnecessarily;</li>
  <li>Share personal information with unauthorized persons;</li>
  <li>Sell, rent, trade, or commercially exploit personal information;</li>
  <li>Use personal information for unrelated or unauthorized purposes;</li>
  <li>Disclose confidential information without authorization; or</li>
  <li>Attempt to bypass OJTern's access controls or security measures.</li>
</ul>
 
<h3>18. No Sale or Commercial Exploitation of Company Information</h3>
<p>
  OJTern maintains a strict policy against the sale or unauthorized commercial exploitation of personal information and confidential Company information.
</p>
<p>
  Information collected through OJTern shall be used only for legitimate OJT, educational, administrative, operational, security, and other authorized purposes.
</p>
<p>
  OJTern shall not sell your personal information to advertisers, data brokers, Companies, Organizations, Corporations, Agencies, or other unrelated third parties.
</p>
 
<h3>19. Updates to This Privacy Policy</h3>
<p>
  OJTern may update this Privacy Policy to reflect changes in its features or functions, data processing practices, institutional policies, applicable laws and regulations, privacy requirements, or security practices.
</p>
<p>
  You may be informed of significant changes through appropriate means.
</p>
 
<h3>20. Governing Privacy Law</h3>
<p>
  This Privacy Policy shall be interpreted and implemented in accordance with applicable laws and regulations of the Republic of the Philippines, including <strong>Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012</strong>, its Implementing Rules and Regulations, and applicable issuances of the National Privacy Commission.
</p>
 
<h3>21. Contact</h3>
<p>
  For privacy concerns, questions, requests, or complaints regarding the processing of your personal information through OJTern, you may contact:
</p>
<p style={{ fontFamily: font.ui, color: color.ink }}>
  Email:{" "}
  <a
    href="mailto:ojtern@gmail.com"
    style={{
      color: color.ink,
      textDecoration: "underline",
      cursor: "pointer",
      fontWeight: 700,
    }}
  >
    ojtern@gmail.com
  </a>
</p>
 
<p style={{ fontFamily: font.ui, color: color.ink, marginBottom: 0 }}> 
  School Address: Dominican College of Tarlac, Inc.<br /> 
  McArthur Highway, Poblacion (Sto. Rosario), Capas, Tarlac, Philippines </p>
</>
);


// Props:
//   onBack               — navigate back to SignUpStep1
//   onGoSignIn           — navigate to SignIn
//   onSubmitSuccess      — called after successful Firebase registration
//   step1Data            — form data from Step 1 { companyName, industry,
//                          location, email, password }
const SignUpStep2Screen = ({ onBack, onGoSignIn, onSubmitSuccess, step1Data }) => {
  const [agreed, setAgreed]         = useState(false);
  const [dragging, setDragging]     = useState(false);
  const [files, setFiles]           = useState([]);
  const [error, setError]           = useState("");
  const [expanded, setExpanded]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTerms, setShowTerms]   = useState(false);
  const [termsScrolledToEnd, setTermsScrolledToEnd] = useState(false);
  const termsScrollRef = useRef(null);
  
 
  const MAX_TOTAL_MB = 10;
  const MAX_BYTES    = MAX_TOTAL_MB * 1024 * 1024;
 
 
  const addFiles = (newFiles) => {
    const validTypes = ["application/pdf", "image/png"];
    const filtered   = Array.from(newFiles).filter(f => validTypes.includes(f.type));
    if (filtered.length !== Array.from(newFiles).length) {
      setError("Only PDF and PNG files are allowed.");
      return;
    }
    const combined  = [...files, ...filtered];
    const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_BYTES) {
      setError("Total file size exceeds 10MB limit.");
      return;
    }
    setError("");
    setFiles(combined);
  };
 
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };
 
  const handleBrowse = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };
 
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setError("");
  };
 
  // ── Terms & Conditions modal handlers ─────────────────────────────────────
  const openTerms = () => {
  setTermsScrolledToEnd(false);
  setShowTerms(true);
};
 
const handleTermsScroll = (e) => {
  const el = e.target;
 
  const reachedEnd =
    el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
 
  if (reachedEnd) {
    setTermsScrolledToEnd(true);
  }
};
 
const handleCheckboxClick = () => {
  if (agreed) {
    setAgreed(false);
  } else {
    openTerms();
  }
};
 
const handleAgreeTerms = () => {
  setAgreed(true);
  setShowTerms(false);
  setError("");
};
 
  // ── Submit: upload docs → Firebase Auth → Firestore ──────────────────────
  const handleSubmit = async () => {
    if (!agreed) {
      setError("You must agree to the privacy policy before submitting.");
      return;
    }
    if (files.length === 0) {
      setError("You must upload at least one image or files of your company's proof of verification before submitting.");
      return;
    }
    if (!step1Data) {
      setError("Step 1 data is missing. Please go back and try again.");
      return;
    }
 
    setSubmitting(true);
    setError("");
 
    try {
      // 1. Upload all files to Cloudinary
      const uploadedUrls = await uploadFiles(files);
 
      // 2. Register via AuthService (creates Auth user + Firestore doc)
      // Normalize industry to an array — Firestore's "array-contains-any"
      // query (used in the coordinator company list) requires the
      // `industry` field to be an array, but Step 1's <select> only ever
      // produces a single string.
      const normalizedStep1Data = {
        ...step1Data,
        industry: Array.isArray(step1Data.industry)
          ? step1Data.industry
          : [step1Data.industry],
      };
 
      await registerCompany(normalizedStep1Data, uploadedUrls);
 
      setShowSuccess(true);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
      } else {
        setError(err.message || "Submission failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };
 
  const totalSize  = files.reduce((sum, f) => sum + f.size, 0);
  const totalMB    = (totalSize / (1024 * 1024)).toFixed(2);
  const isOverLimit = totalSize > MAX_BYTES;
 
return (
  <>
    <ResponsiveStyles />
    <div className="su2-wrapper" style={{ position: "relative" }}>
      <div className="su2-panel">

        <div className="su2-panel-scroll">
          <p className="su2-step-label">Step 2 of 2</p>
          <h1 className="su2-panel-title">Proof of Verification</h1>
          <hr className="su2-panel-divider" />

          {/* Error */}
          {error && (
            <p style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: color.danger, marginBottom: space.sm, textAlign: "center" }}>
              ⚠️ {error}
            </p>
          )}

          {/* Notice */}
          <p className="su2-field-label">Document Verification:</p>
          <div className="su2-notice">
            <p style={{ fontFamily: font.ui, fontSize: type.label.fontSize, fontWeight: type.label.fontWeight, color: color.ink, marginBottom: "4px" }}>
              Verification required
            </p>
            <p style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: color.inkMuted, lineHeight: type.helper.lineHeight, margin: 0 }}>
              Upload valid proof documents (e.g. BIR Certificate, SEC Registration, DTI Permit, or Business Permit) to verify your company's legitimacy.
            </p>
          </div>

          {/* Drop zone */}
          <p className="su2-field-label">Upload Documents:</p>
          <div
            className="su2-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragging ? color.ink : isOverLimit ? color.danger : color.wine400}`,
              background: dragging ? color.wine800 : color.wine600,
            }}
          >
            <p style={{ fontFamily: font.ui, fontSize: "0.95rem", fontWeight: 500, color: color.ink, marginBottom: "6px" }}>
              Drag &amp; drop files here
            </p>
            <label style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: color.inkMuted, textDecoration: "underline", cursor: "pointer" }}>
              or browse to upload
              <input type="file" accept=".pdf,.png" multiple onChange={handleBrowse} style={{ display: "none" }} />
            </label>
            <p style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: color.inkFaint, marginTop: "6px", marginBottom: 0 }}>
              PDF, PNG — max 10MB total
            </p>
          </div>

          {/* File list header */}
          {files.length > 0 && (
            <div style={{ marginBottom: space.md }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: color.wine600, borderRadius: "16px",
                padding: "10px 16px",
              }}>
                <span style={{ fontFamily: font.ui, fontSize: type.label.fontSize, fontWeight: type.label.fontWeight, color: color.ink }}>
                  📁 {files.length} file{files.length > 1 ? "s" : ""} attached
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: isOverLimit ? color.danger : color.inkMuted }}>
                    {totalMB} MB / 10 MB {isOverLimit ? "⚠️" : "✅"}
                  </span>
                  <span
                    onClick={() => setExpanded(prev => !prev)}
                    style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: color.ink, textDecoration: "underline", cursor: "pointer" }}
                  >
                    {expanded ? "Hide ▲" : "View all ▼"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer — nasa LOOB na ng scroll */}
          <div className="su2-panel-footer">

            {/* Checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: space.md }}>
              <div
                onClick={handleCheckboxClick}
                style={{ width: "18px", height: "18px", border: `2px solid ${color.onWineFaint}`, borderRadius: "5px", cursor: "pointer", flexShrink: 0, background: agreed ? color.wine600 : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {agreed && <span style={{ color: color.ink, fontSize: "11px", fontWeight: "700" }}>✓</span>}
              </div>
              <span style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: color.onWineMuted }}>
                <span
                  onClick={openTerms}
                  style={{ textDecoration: "underline", cursor: "pointer", color: color.onWine }}
                >
                  I have read and agree to the Terms and Conditions and Privacy Policy.
                </span>
              </span>
            </div>

            {/* Back + Submit */}
            <div className="su2-action-row-flex">
              <button onClick={onBack} className="su2-btn-back" type="button">
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="su2-btn"
                disabled={submitting}
                style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>

            <p style={{ fontFamily: font.ui, textAlign: "center", fontSize: type.helper.fontSize, color: color.onWineMuted, margin: 0 }}>
              Already have an account?{" "}
              <span
                onClick={onGoSignIn}
                style={{ color: color.onWine, textDecoration: "underline", cursor: "pointer", fontWeight: "600" }}
              >
                Sign-in
              </span>
            </p>

          </div>
        </div>
        {/* ── dulo ng su2-panel-scroll ── */}

        {/* File modal overlay */}
        {expanded && (
          <div className="su2-modal-overlay">
            <div className="su2-modal-inner">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
                <span style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 600, color: color.ink }}>
                  📁 Attached files ({files.length})
                </span>
                <span
                  onClick={() => setExpanded(false)}
                  style={{ cursor: "pointer", color: color.onWine, background: color.ink, borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "0.9rem", flexShrink: 0 }}
                >
                  ✕
                </span>
              </div>
              <p style={{ fontFamily: font.ui, fontSize: type.helper.fontSize, color: isOverLimit ? color.danger : color.inkMuted, marginBottom: "10px", textAlign: "right" }}>
                Total: {totalMB} MB / 10 MB {isOverLimit ? "⚠️ Over limit!" : "✅"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto" }}>
                {files.map((file, index) => (
                  <div key={index} className="su2-file-row">
                    <span className="su2-file-name">
                      📄 {file.name}{" "}
                      <span style={{ color: color.inkFaint }}>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </span>
                    <span
                      onClick={() => removeFile(index)}
                      style={{ cursor: "pointer", color: color.danger, fontWeight: "700", fontSize: "1rem", marginLeft: "8px", flexShrink: 0 }}
                    >
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Terms & Conditions modal overlay */}
        {showTerms && (
          <div className="su2-modal-overlay" onClick={() => setShowTerms(false)}>
            <div className="su2-terms-inner" onClick={(e) => e.stopPropagation()}>
              <div className="su2-terms-header">
                <span style={{ fontFamily: font.ui, fontSize: "1rem", fontWeight: 600, color: color.ink }}>
                  Terms and Conditions &amp; Privacy Policy
                </span>
                <span
                  onClick={() => setShowTerms(false)}
                  style={{ cursor: "pointer", color: color.onWine, background: color.ink, borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "0.9rem", flexShrink: 0 }}
                >
                  ✕
                </span>
              </div>
              <div className="su2-terms-scroll" onScroll={handleTermsScroll} ref={termsScrollRef}>
                <TermsContent />
              </div>
              <div className="su2-terms-footer">
                <button
                  onClick={handleAgreeTerms}
                  className="su2-btn"
                  disabled={!termsScrolledToEnd}
                  style={{
                    background: color.ink,
                    color: color.onWine,
                    opacity: termsScrolledToEnd ? 1 : 0.5,
                    cursor: termsScrolledToEnd ? "pointer" : "not-allowed",
                  }}
                >
                  I Agree
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success overlay */}
        {showSuccess && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px", borderRadius: radius.panel,
          }}>
            <div style={{
              background: color.wine600, borderRadius: radius.card,
              padding: "32px 26px", width: "clamp(280px, 85vw, 370px)",
              maxHeight: "90%", overflowY: "auto",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: space.sm, boxShadow: shadow.panel,
            }}>
              <div style={{
                width: "64px", height: "64px", minWidth: "64px", minHeight: "64px",
                flexShrink: 0, borderRadius: "50%",
                background: `${color.success}22`, display: "flex",
                alignItems: "center", justifyContent: "center", marginBottom: "4px",
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke={color.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              <p style={{ fontFamily: font.ui, fontWeight: 600, fontSize: "1.1rem", color: color.ink, margin: 0, textAlign: "center", lineHeight: 1.35 }}>
                Your submission has been received and is pending approval.
              </p>

              <p style={{ fontFamily: font.ui, fontSize: type.body.fontSize, color: color.inkMuted, margin: 0, textAlign: "center", lineHeight: type.body.lineHeight }}>
                A confirmation was sent to{" "}
                <span style={{ color: color.ink, fontWeight: 600, wordBreak: "break-all" }}>
                  {step1Data?.email}
                </span>
                . You'll get another email once a Coordinator has updated your registration.
              </p>

              <button
                onClick={() => { setShowSuccess(false); onSubmitSuccess(); }}
                className="su2-btn"
                style={{ marginTop: "10px", background: color.ink, color: color.onWine }}
              >Ok</button>
            </div>
          </div>
        )}

      </div>
    </div>
  </>
);
};

export default SignUpStep2Screen;