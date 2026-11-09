# Obsidian Research

Next.js App Router, TypeScript, Tailwind CSS and Supabase. The public site and student and staff portals share the approved Obsidian Research wordmark, campaign photography, blue and gold accents, and mobile layout.

## Run locally

Use Node.js 22 or newer and run these commands from this directory.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The catalogue reads the project in `.env.local`. The supplied workspace was connected to the authorised Obsidian Research project using its public URL and publishable key. For another installation, copy `.env.example` to `.env.local` and set the variables below.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Site origin. Use the actual HTTPS origin in production and the same hostname in the local browser. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key from Supabase Connect. A legacy anon key also works. |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret or legacy service-role key for checkout reconciliation and the contact inbox. |
| `PAYMENT_SETTINGS_ENCRYPTION_KEY` | Base64-encoded 32 random bytes for credentials saved in the staff console. Keep a secure backup. |
| `FLUTTERWAVE_SECRET_KEY` | Optional environment fallback for the Flutterwave v3 secret key. Start with a test key. |
| `FLUTTERWAVE_WEBHOOK_SECRET` | Optional fallback for the random hash entered in Flutterwave's webhook settings. |
| `CONTACT_RATE_LIMIT_SECRET` | Random server-only string used to HMAC the contact rate-limit key. |
| `IDENTITY_ENCRYPTION_KEY` | Base64-encoded 32 random bytes for optional NIN encryption. Keep a secure backup before rotation. |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional application confirmation email. Use a verified sender and domain. |

The Supabase management token is used only by the migration helper and does not belong in the application's runtime environment. Configure production secrets in Vercel or your hosting secret manager.

## Supabase setup and migrations

The SQL files in `supabase/migrations` cover the catalogue, role-based access, registration, payments, private conversations, editorial media and workspace documents. Two courses are seeded with the confirmed **₦100,000** registration fee and a 20% discount for the first 20 eligible registrations in each course. Class dates, duration, delivery format and capacity are left for staff to confirm.

For a fresh project, use either the Supabase CLI migration workflow or the Management API helper consistently. The helper reads the management token from hidden standard input. It checks installed migration names and spaces submissions because the Management API assigns versions at second granularity.

```sh
node scripts/manage-db.mjs list
node scripts/manage-db.mjs inspect PROJECT_REF
node scripts/manage-db.mjs apply PROJECT_REF
node scripts/manage-db.mjs connect PROJECT_REF
```

`connect` creates an ignored `.env.local` with public connection settings and refuses to overwrite an existing file. The Management API generates its own version timestamps for these migrations, so continue applying them with the helper or reconcile the CLI migration history before switching tools.

For a fresh Supabase project, place the three original PDFs in the ignored `documents/` folder and run `node scripts/manage-db.mjs upload-documents PROJECT_REF` after applying migrations. The workspace downloads use short-lived signed links from the private `workspace-documents` bucket.

In Supabase Auth, enable email/password sign-up and email confirmation. Set the Site URL to your production origin and add the exact `/auth/confirm` redirect URLs for each approved environment. Configure custom SMTP for public sign-up, password reset and delivery to students. Test verification and recovery from the browser users will use to sign in. The handler supports Supabase PKCE codes and token-hash links with `type=email`, `type=signup` or `type=recovery`. Recovery links must return to `/account/update`.

### First administrator

1. Create an account from the site's registration screen and confirm its email.
2. In the project's Supabase SQL Editor, replace the example address with that exact verified address. Confirm the result returns one row.

```sql
insert into public.user_roles(user_id, role)
select id, 'super_admin'
from auth.users
where lower(email) = lower('confirmed-admin@example.com')
  and email_confirmed_at is not null
on conflict(user_id) do update set role = excluded.role
returning user_id, role;
```

3. Sign in and open `/admin`. Staff Access can assign further roles to confirmed accounts.

- **Super administrator** manages staff, content, training and finance.
- **Administrator** manages content, training and finance.
- **Training coordinator** manages courses, batches, applications, identity review and enrolments. The finance ledger is restricted.
- **Finance officer** sees a minimal billing directory and payment records. Applicant addresses, dates of birth, NIN, photographs and internal training notes are restricted.

## Payment workflow

Students select Flutterwave, cash or bank transfer on the application. They can update their choice after approval and see private instructions in their dashboard. Staff verify offline funds before recording the payment. An eligible installment or full balance is checked in the database, and confirmed payments issue receipts automatically.

After setting `SUPABASE_SECRET_KEY` and `PAYMENT_SETTINGS_ENCRYPTION_KEY` on the host, a super administrator can enter or rotate the provider credentials and pause new checkouts from **Payment settings**. Saved values are encrypted and take precedence over their environment fallbacks. The form does not display stored credentials. Generate the encryption key with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"` in a private terminal and save it in the host's secret manager.

For Flutterwave Standard v3, configure `https://YOUR_ORIGIN/api/payments/webhook` in the merchant dashboard, set the matching secret hash and enable retries. The server compares the documented `verif-hash` header, verifies the transaction with Flutterwave, and reconciles the exact reference, amount, currency and transaction ID. The checkout redirect is independently verified. Finance can verify a missed callback with its checkout reference and Flutterwave transaction ID. Duplicate callbacks or webhooks return the existing confirmation.

Test in the Flutterwave test environment before accepting live payments. Verify successful, failed, repeated and delayed notifications and review any exception in the finance ledger. The site does not launch an online checkout unless the provider and reconciliation secrets are configured. Set verified cash and bank transfer instructions in **Finance** before launch.

## Customer workspace

- **Courses → Coupons & promotions:** manage automatic offers and optional codes. A code requires an expiry and usage limit. Checking a code shows an estimate; the discount is reserved on successful submission and cannot be combined with an automatic offer.
- **Site content → Service:** publish services with a price in naira or leave the amount blank to offer a quote. Customers can request services with their existing accounts. Requests keep the title and price shown when submitted.
- **Site content → News article:** create drafts, add a cover or inline photos, and publish to **News**. Photos uploaded to the editorial bucket are public media, so only upload pictures intended for publication.
- **Customer inbox:** staff can answer both service requests and general support chats. Customers see replies under **Messages**.

## Student data and launch checks

Student dashboards, receipts and PDFs require an authenticated account. RLS and server checks restrict access to the applicant and appropriate staff. Identity evidence is off by default. Enable it per course only after documenting the need and obtaining approval for the privacy workflow. Photographs use private storage and short-lived signed URLs. NINs are encrypted and can be compared against an original without displaying the stored value. Keep identity evidence separate where verification status is enough.

The website policy and PDF agreement contain draft refund, identity and retention terms. Before opening the site to students, have Nigerian counsel review them and confirm the data handling and guardian-verification process. Adopt a documented retention schedule and assign a staff owner to review expired records, remove evidence from private storage and clear the corresponding identity fields. Preserve required finance records and documented legal holds. Supabase storage objects should be removed through its Storage API, rather than by deleting object metadata in SQL. Review contact enquiries under the same retention process.

## Verify and deploy on Vercel

```sh
npm run check
npm run test:db
npm run build
```

Import the repository into Vercel using this directory as the project root and Next.js as the framework. Use the generated lockfile, add the production environment variables, then connect the intended domain. Complete Auth redirect and SMTP configuration, bootstrap the verified administrator, and configure the Flutterwave test webhook. Review both a student and each staff role before inviting applicants. Add the final public programme dates and availability in the course editor.

The database test runs all migrations with a minimal Supabase auth/storage harness. It covers the early-bird limit, coupon expiry and usage, cross-account chat isolation, service price snapshots, draft visibility, finance access, and idempotent payment reconciliation. For a live release, separately test email delivery, document downloads and Flutterwave end-to-end using test credentials.

References

- [Supabase SSR authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Flutterwave Standard](https://developer.flutterwave.com/docs/flutterwave-standard-1)
- [Flutterwave webhooks and verification](https://developer.flutterwave.com/docs/webhooks)
