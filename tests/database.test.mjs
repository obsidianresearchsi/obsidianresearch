import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";

test("migrations, owner isolation, offer limits, and payment reconciliation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema auth,storage to anon,authenticated,service_role;
      grant select,insert,delete on storage.objects to authenticated;
    `);
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    for (const filename of (await readdir(migrations)).sort()) {
      await db.exec(await readFile(new URL(filename, migrations), "utf8"));
    }
    const root = randomUUID(), finance = randomUUID(), student = randomUUID(), other = randomUUID();
    const learners = [student, other, ...Array.from({ length: 19 }, () => randomUUID())];
    for (const id of [root, finance, ...learners]) {
      await db.query("insert into auth.users values($1,$2,now(),'{}')",[id,`${id}@example.test`]);
    }
    await db.query("insert into public.user_roles values($1,'super_admin',now()),($2,'finance',now())",[root,finance]);
    async function as(role, id = "") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
      await db.exec(`set role ${role}`);
    }
    async function rows(sql, args) { return (await db.query(sql, args)).rows; }
    const [{id: course}] = await rows("select id from public.courses where slug='networking-infrastructure'");
    await as("anon");
    const earlyOffers = await rows("select claim_limit,remaining from public.public_offers()");
    assert.deepEqual(earlyOffers,[{claim_limit:20,remaining:20},{claim_limit:20,remaining:20}]);
    await assert.rejects(rows("select * from public.applications"), /permission denied/);
    const data = { full_name: "Example Student", phone: "08012345678", date_of_birth: "2000-01-01",
      address: "Example address", state: "Katsina", occupation: "Student", education: "Graduate",
      rules: true, terms: true, privacy: true, refund: true, payment_method: "cash" };
    let first;
    let second;
    for (const [i,id] of learners.entries()) {
      await as("authenticated",id);
      const [application] = await rows("select * from public.submit_application($1,$2)", [course,data]);
      assert.equal(Number(application.payable_kobo),i < 20 ? 8000000 : 10000000);
      if (i===0) {
        first=application.id;
        const [duplicate] = await rows("select * from public.submit_application($1,$2)", [course,data]);
        assert.equal(duplicate.id,first);
        await assert.rejects(rows("select public.begin_checkout($1)",[first]),/Payment is not open/);
      } else {
        assert.equal((await rows("select * from public.applications where id=$1",[first])).length,0);
        if (i===1) second=application.id;
      }
      assert.equal((await rows("select * from public.payment_settings")).length,0);
      await assert.rejects(rows("update public.applications set original_kobo=0"),/permission denied/);
    }
    await as("authenticated",finance);
    assert.equal((await rows("select * from public.applications")).length,0);
    assert.equal((await rows("select * from public.application_identity")).length,0);
    await assert.rejects(rows("select public.review_application($1,'approved',null,null)",[first]),/Access denied/);
    await as("authenticated",root);
    await rows("select public.review_application($1,'approved',null,'Verified')",[first]);
    await rows("select public.review_application($1,'approved',null,null)",[second]);
    await as("authenticated",student);
    assert.equal((await rows("select * from public.payment_settings")).length,1);
    await rows("select public.choose_payment($1,'flutterwave',null)",[first]);
    const [[charge], [repeat]] = await Promise.all([
      rows("select * from public.begin_checkout($1)",[first]),
      rows("select * from public.begin_checkout($1)",[first]),
    ]);
    assert.equal(charge.id,repeat.id);
    assert.equal(repeat.created,false);
    await assert.rejects(rows("select public.confirm_flutterwave($1,'1234',8000000,'NGN')",[charge.reference]),/permission denied/);
    await as("service_role");
    await assert.rejects(rows("select public.confirm_flutterwave($1,'1234',8000001,'NGN')",[charge.reference]),/does not match/);
    const verified = (reference, transaction, amount, currency, source) => rows(
      "select public.confirm_flutterwave($1,$2,$3,$4,$5) as result",
      [reference,transaction,amount,currency,source],
    ).then(([row]) => row.result);
    assert.equal(await verified(charge.reference,"1234",7999999,"NGN","webhook"),"details_mismatch");
    assert.equal(await verified(charge.reference,"1234",8000000,"USD","webhook"),"details_mismatch");
    const outcomes = await Promise.all([
      verified(charge.reference,"1234",8000000,"NGN","webhook"),
      verified(charge.reference,"1234",8000000,"NGN","callback"),
    ]);
    assert.deepEqual(outcomes.sort(),["confirmed","duplicate"]);
    assert.equal(await verified(charge.reference,"4321",8000000,"NGN","admin"),"reference_reused");
    await as("authenticated",student);
    assert.equal((await rows("select * from public.payment_receipts")).length,1);
    const [{status}] = await rows("select status from public.applications where id=$1",[first]);
    assert.equal(status,"payment_confirmed");
    await as("authenticated",root);
    await rows("select public.review_application($1,'enrolled',null,null)",[first]);
    await as("authenticated",student);
    assert.equal((await rows("select * from public.enrollments")).length,1);
    await as("authenticated",other);
    assert.equal((await rows("select * from public.enrollments")).length,0);
    assert.equal((await rows("select * from public.payment_receipts")).length,0);
    const [expiredCheckout] = await rows("select * from public.begin_checkout($1)",[second]);
    await as("service_role");
    assert.equal(await verified(expiredCheckout.reference,"1234",8000000,"NGN","webhook"),"transaction_reused");
    await db.exec("reset role");
    await rows("update public.payments set checkout_expires_at=now()-interval '1 minute' where id=$1",[expiredCheckout.id]);
    await as("authenticated",finance);
    assert.equal((await rows("select * from public.finance_accounts()")).length,2);
    const [manual] = await rows("select public.record_manual_payment($1,'transfer',8000000,'TEST-BANK-REF') as id",[second]);
    const [retry] = await rows("select public.record_manual_payment($1,'transfer',8000000,'TEST-BANK-REF') as id",[second]);
    assert.equal(manual.id,retry.id);
    await assert.rejects(rows("select public.record_manual_payment($1,'transfer',8000000,'TEST-BANK-REF')",[first]),/already in use/);
    const [{count: manualAudit}] = await rows("select count(*) from public.audit_logs where entity='payments' and entity_id=$1",[manual.id]);
    assert.equal(Number(manualAudit),1);
    await as("service_role");
    assert.equal(await verified(expiredCheckout.reference,"4321",8000000,"NGN","webhook"),"balance_review");
    await as("authenticated",finance);
    assert.equal(Number((await rows("select paid_kobo from public.finance_accounts() where id=$1",[second]))[0].paid_kobo),8000000);
    assert.equal((await rows("select action from public.audit_logs where action='flutterwave_balance_review'")).length,1);

    const enquiry = ["Example Visitor","visitor@example.test","Interior","Please send a quote.","test-source"];
    const sendEnquiry = (values = enquiry) => rows(
      "select public.record_enquiry($1,$2,$3,$4,$5) as id",values,
    ).then(([row]) => row.id);
    await as("anon");
    await assert.rejects(sendEnquiry(),/permission denied/);
    await as("service_role");
    const contacts = await Promise.all([sendEnquiry(),sendEnquiry()]);
    assert.equal(contacts[0],contacts[1]);
    for (let n=1;n<5;n++) await sendEnquiry(enquiry.map((value,i) => i===2 ? `Topic ${n}` : value));
    await assert.rejects(sendEnquiry(enquiry.map((value,i) => i===2 ? "Over the limit" : value)),/Too many recent enquiries/);
    await rows("update public.contact_enquiries set notification_status='sent' where id=$1",[contacts[0]]);
    await as("authenticated",root);
    await rows("update public.contact_enquiries set resolved=true where id=$1",[contacts[0]]);
    assert.deepEqual(await rows("select resolved,notification_status from public.contact_enquiries where id=$1",[contacts[0]]),
      [{resolved:true,notification_status:"sent"}]);
    assert.equal((await rows("select action from public.audit_logs where entity_id=$1",[contacts[0]])).length,3);
    await as("authenticated",other);
    assert.equal((await rows("select * from public.payment_receipts")).length,1);

    await db.exec("reset role");
    const [{id:forex}] = await rows("select id from public.courses where slug='forex-financial-markets'");
    await as("authenticated",root);
    const [{id:coupon}] = await rows(`select public.save_discount($1,null,'Trial coupon','percent',10,
      2,null,now()+interval '1 day',true,'trial-10') id`,[forex]);
    await rows(`select public.save_discount($1,null,'Expired coupon','percent',10,
      2,now()-interval '2 days',now()-interval '1 day',true,'OLD-10')`,[forex]);
    await as("authenticated",student);
    assert.deepEqual((await rows("select * from public.quote_registration_coupon($1,' trial-10 ')",[forex]))
      .map((r) => [Number(r.discount_kobo),Number(r.payable_kobo)]),[[1000000,9000000]]);
    assert.deepEqual(await rows("select * from public.quote_registration_coupon($1,'TRIAL-10')",[course]),[]);
    assert.deepEqual(await rows("select * from public.quote_registration_coupon($1,'OLD-10')",[forex]),[]);
    assert.deepEqual(await rows("select * from public.discounts"),[]);
    await assert.rejects(rows("select public.save_discount($1,null,'Forbidden','percent',10,1,null,null,true)",[forex]),/Access denied/);
    await assert.rejects(rows("select * from public.submit_application($1,$2)",[forex,{...data,coupon_code:"OLD-10"}]),/invalid, expired/);
    await as("authenticated",root);
    assert.equal((await rows("select claimed from public.discounts where id=$1",[coupon]))[0].claimed,0);
    await as("authenticated",student);
    const [couponApplication] = await rows("select * from public.submit_application($1,$2)",[forex,{...data,coupon_code:"trial-10"}]);
    assert.equal(Number(couponApplication.payable_kobo),9000000);
    await as("authenticated",root);
    await rows("select public.review_application($1,'rejected',null,'Test review')",[couponApplication.id]);
    await as("authenticated",student);
    await assert.rejects(rows("select * from public.submit_application($1,$2)",[forex,{...data,coupon_code:"TRIAL-10"}]),/invalid, expired/);
    await as("authenticated",other);
    const [onlineApplication] = await rows("select * from public.submit_application($1,$2)",
      [forex,{...data,coupon_code:"TRIAL-10",payment_method:"flutterwave"}]);
    await assert.rejects(rows("select * from public.begin_checkout($1,4500000)",[onlineApplication.id]),/Pay the full balance/);
    const [earlyCheckout] = await rows("select * from public.begin_checkout($1)",[onlineApplication.id]);
    assert.equal(Number(earlyCheckout.amount_kobo),9000000);
    assert.equal((await rows("select status from public.applications where id=$1",[onlineApplication.id]))[0].status,"submitted");
    await as("authenticated",root);
    await assert.rejects(rows("select public.review_application($1,'rejected',null,null)",[onlineApplication.id]),/checkout is active/);
    await rows("select public.review_application($1,'under_review',null,null)",[onlineApplication.id]);
    await as("service_role");
    assert.equal(await verified(earlyCheckout.reference,"5678",9000000,"NGN","webhook"),"confirmed");
    assert.equal(await verified(earlyCheckout.reference,"5678",9000000,"NGN","callback"),"duplicate");
    await as("authenticated",other);
    assert.equal((await rows("select status from public.applications where id=$1",[onlineApplication.id]))[0].status,"under_review");
    assert.equal((await rows("select * from public.payment_receipts where payment_id=$1",[earlyCheckout.id])).length,1);
    await assert.rejects(rows("select public.begin_checkout($1)",[onlineApplication.id]),/amount exceeds the balance/);
    await as("authenticated",finance);
    assert.equal(Number((await rows("select paid_kobo from public.finance_accounts() where id=$1",[onlineApplication.id]))[0].paid_kobo),9000000);
    await as("authenticated",root);
    await assert.rejects(rows("select public.review_application($1,'rejected',null,null)",[onlineApplication.id]),/record a note/);
    await rows("select public.review_application($1,'approved',null,null)",[onlineApplication.id]);
    assert.equal((await rows("select status from public.applications where id=$1",[onlineApplication.id]))[0].status,"payment_confirmed");
    await as("authenticated",learners[2]);
    await assert.rejects(rows("select * from public.submit_application($1,$2)",[forex,{...data,coupon_code:"TRIAL-10"}]),/usage limit/);
    await as("authenticated",root);
    assert.equal((await rows("select claimed from public.discounts where id=$1",[coupon]))[0].claimed,2);

    const [{id:service}] = await rows("select id from public.site_content where kind='service' and slug='solar-power'");
    await rows(`update public.site_content set details=jsonb_build_object('price_kobo',15000000) where id=$1`,[service]);
    const [{id:draft}] = await rows(`insert into public.site_content(kind,slug,title,summary,body)
      values('article','test-draft','A draft update','Not published yet','Draft text') returning id`);
    const [{id:project}] = await rows(`insert into public.site_content(kind,slug,title,details)
      values('portfolio','test-project','A draft project','{"project_url":"https://example.com/project"}') returning id`);
    await as("anon");
    assert.deepEqual(await rows("select id from public.site_content where id=$1",[draft]),[]);
    assert.deepEqual(await rows("select id from public.site_content where id=$1",[project]),[]);
    await assert.rejects(rows("select public.start_customer_thread(null,'A question')"),/permission denied/);
    await as("authenticated",student);
    await assert.rejects(rows("select public.start_customer_thread($1,'Unavailable')",[draft]),/unavailable/);
    const [{id:request}] = await rows("select public.start_customer_thread($1,'I need backup power.') id",[service]);
    const [{id:chat}] = await rows("select public.start_customer_thread(null,'Where is the centre?') id");
    assert.notEqual(chat,request);
    const [{id:duplicateRequest}] = await rows("select public.start_customer_thread($1,'Retry') id",[service]);
    assert.equal(duplicateRequest,request);
    assert.equal((await rows("select id from public.customer_messages where thread_id=$1",[request])).length,1);
    await assert.rejects(rows("select public.set_customer_thread_status($1,'approved')",[request]),/Access denied/);
    await assert.rejects(rows("select * from public.flutterwave_settings"),/permission denied/);
    await assert.rejects(rows("insert into storage.objects(bucket_id,name) values('editorial-media','student.webp')"),/row-level security/);
    await as("authenticated",other);
    assert.deepEqual(await rows("select * from public.customer_threads"),[]);
    assert.deepEqual(await rows("select * from public.customer_messages"),[]);
    await assert.rejects(rows("select public.reply_customer_thread($1,'Other customer')",[request]),/unavailable/);
    await as("authenticated",finance);
    assert.deepEqual(await rows("select * from public.customer_threads"),[]);
    await as("authenticated",root);
    await rows("insert into storage.objects(bucket_id,name) values('editorial-media','staff.webp')");
    await rows("update public.site_content set published=true where id=$1",[draft]);
    await rows("update public.site_content set published=true where id=$1",[project]);
    await rows(`update public.site_content set details=jsonb_build_object('price_kobo',18000000),published=false where id=$1`,[service]);
    await rows("select public.reply_customer_thread($1,'We can help with that.')",[request]);
    await rows("select public.set_customer_thread_status($1,'in_review')",[request]);
    await assert.rejects(rows("select * from public.flutterwave_settings"),/permission denied/);
    await as("authenticated",student);
    const [submittedRequest] = await rows("select price_kobo,status from public.customer_threads where id=$1",[request]);
    assert.equal(Number(submittedRequest.price_kobo),15000000);
    assert.equal(submittedRequest.status,"in_review");
    assert.deepEqual(await rows("select from_staff,body from public.customer_messages where thread_id=$1 order by id",[request]),
      [{from_staff:false,body:"I need backup power."},{from_staff:true,body:"We can help with that."}]);
    await as("authenticated",other);
    await assert.rejects(rows("select public.start_customer_thread($1,'This was unpublished')",[service]),/unavailable/);
    await as("anon");
    assert.equal((await rows("select id from public.site_content where id=$1",[draft])).length,1);
    assert.equal((await rows("select id from public.site_content where id=$1",[project])).length,1);

    const interiorKey = randomUUID();
    const render = `${student}/${interiorKey}.jpg`;
    await assert.rejects(rows("select public.submit_interior_review($1,'Example design',$2)",[interiorKey,render]),/permission denied/);
    await as("authenticated",other);
    await assert.rejects(rows("insert into storage.objects(bucket_id,name) values('interior-renders',$1)",[render]),/row-level security/);
    await as("authenticated",student);
    await rows("insert into storage.objects(bucket_id,name) values('interior-renders',$1)",[render]);
    assert.equal((await rows("select name from storage.objects where name=$1",[render])).length,0);
    const [{id: interiorThread}] = await rows("select public.submit_interior_review($1,'Example design',$2) id",[interiorKey,render]);
    const [{id: retriedThread}] = await rows("select public.submit_interior_review($1,'Example design',$2) id",[interiorKey,render]);
    assert.equal(interiorThread,retriedThread);
    assert.equal((await rows("select id from public.customer_messages where thread_id=$1",[interiorThread])).length,1);
    assert.equal((await rows("select name from storage.objects where name=$1",[render])).length,1);
    await as("authenticated",other);
    assert.equal((await rows("select name from storage.objects where name=$1",[render])).length,0);
    await as("authenticated",root);
    assert.equal((await rows("select name from storage.objects where name=$1",[render])).length,1);

    const networkKey = randomUUID();
    const networkPlan = { plan: { devices:[{id:1,kind:"v4",x:18,y:37}] }, prices:{v4:55000000} };
    const submitNetwork = () => rows("select public.submit_network_review($1,$2,'Network budget for review',$3) as id",
      [student,networkKey,networkPlan]);
    await as("authenticated",student);
    await assert.rejects(submitNetwork(),/permission denied/);
    await as("service_role");
    const [[network], [repeatedNetwork]] = await Promise.all([submitNetwork(),submitNetwork()]);
    assert.equal(network.id,repeatedNetwork.id);
    await as("authenticated",student);
    assert.deepEqual(await rows("select network_plan from public.customer_messages where thread_id=$1",[network.id]),
      [{network_plan:networkPlan}]);
    await as("authenticated",other);
    assert.deepEqual(await rows("select network_plan from public.customer_messages where thread_id=$1",[network.id]),[]);
    await as("authenticated",root);
    assert.equal((await rows("select network_plan from public.customer_messages where thread_id=$1",[network.id])).length,1);

    const material = randomUUID(), materialPath = `${material}.pdf`;
    await as("authenticated",other);
    await assert.rejects(rows("insert into public.course_materials(id,course_id,title,download_name,object_path) values($1,$2,'Lecture notes','notes.pdf',$3)",
      [material,course,materialPath]),/row-level security/);
    await as("authenticated",root);
    await rows("insert into public.course_materials(id,course_id,title,download_name,object_path) values($1,$2,'Lecture notes','notes.pdf',$3)",
      [material,course,materialPath]);
    await assert.rejects(rows("select public.set_course_material_visibility($1,true)",[material]),/Upload the file/);
    await rows("insert into storage.objects(bucket_id,name) values('course-materials',$1)",[materialPath]);
    await rows("select public.set_course_material_visibility($1,true)",[material]);
    await rows("select public.set_course_material_visibility($1,true)",[material]);
    await as("authenticated",student);
    assert.equal((await rows("select id from public.course_materials where id=$1",[material])).length,1);
    assert.equal((await rows("select name from storage.objects where bucket_id='course-materials' and name=$1",[materialPath])).length,1);
    assert.equal((await rows("select id from public.notifications where title='New course material'")).length,1);
    await as("authenticated",other);
    assert.equal((await rows("select id from public.course_materials where id=$1",[material])).length,0);
    assert.equal((await rows("select name from storage.objects where bucket_id='course-materials' and name=$1",[materialPath])).length,0);
    await as("authenticated",root);
    await rows("select public.set_course_material_visibility($1,false)",[material]);
    await rows("insert into public.studio_equipment(kind,brand,model,radius_m) values('ap','Wavlink','Outdoor test',120)");
    await rows("insert into public.studio_equipment(kind,brand,model,watts,surge_watts,voltage,active) values('inverter','Example','Hybrid',3000,6000,48,false)");
    await as("authenticated",student);
    assert.equal((await rows("select id from public.course_materials where id=$1",[material])).length,0);
    await as("anon");
    assert.deepEqual(await rows("select brand from public.studio_equipment"),[{brand:"Wavlink"}]);

    await db.exec("reset role");
    const [{public: documentsPublic}] = await rows("select public from storage.buckets where id='workspace-documents'");
    assert.equal(documentsPublic,false);
    await rows(`insert into storage.objects(bucket_id,name) values
      ('workspace-documents','student-rules-and-regulations.pdf'),
      ('workspace-documents','internal-test.pdf')`);
    await as("authenticated",student);
    assert.deepEqual(await rows("select name from storage.objects where bucket_id='workspace-documents'"),
      [{name:"student-rules-and-regulations.pdf"}]);
    await assert.rejects(rows("insert into storage.objects(bucket_id,name) values('workspace-documents','new.pdf')"),/row-level security/);
    await db.exec("reset role");
    const newcomer = randomUUID();
    await rows("insert into auth.users values($1,$2,now(),'{}')",[newcomer,`${newcomer}@example.test`]);
    await as("authenticated",root);
    await rows("update public.courses set capacity=21 where id=$1",[course]);
    await as("authenticated",newcomer);
    await assert.rejects(rows("select * from public.submit_application($1,$2)",[course,data]),/fully booked/);
    await as("authenticated",root);
    await rows("update public.courses set capacity=null, registration_deadline=now()-interval '1 second' where id=$1",[course]);
    await as("authenticated",newcomer);
    await assert.rejects(rows("select * from public.submit_application($1,$2)",[course,data]),/Registration is closed/);
    await as("authenticated",student);
    assert.equal((await rows("select * from public.submit_application($1,$2)",[course,data]))[0].id,first);
  } finally {
    await db.close();
  }
});
