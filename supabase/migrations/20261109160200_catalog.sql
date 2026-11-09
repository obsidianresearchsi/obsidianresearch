insert into public.site_content(kind,slug,title,summary,body,details,position,published) values
('company','profile','Obsidian Research',
 'We build digital infrastructure, develop technology solutions, and teach practical skills at our training centre in Katsina.',
 'Our work brings together technical implementation, consulting and professional education. We help organisations scope and deploy technology, and help learners build confidence through practical work.',
 '{"tagline":"Innovating Technology. Connecting People. Delivering Smart Solutions.","mission":"Make practical technology and professional education more accessible through hands-on work and clear guidance.","vision":"Help organisations and learners in Nigeria use technology with confidence.","phone":"+234 906 341 2927","website":"https://www.obsidianresearch.si","address":"Office No. 14, Mangal Plaza, Opposite Water Board, Katsina State, Nigeria.","email":"","banner":"","cashInstructions":"Bring your application reference to the training centre. Ask staff for a receipt when you pay.","transferInstructions":"Contact the training centre with your application reference for verified bank details before sending funds."}',0,true),
('service','ai-machine-learning','AI & Machine Learning','Intelligent automation and data tools built around real business needs.',
 'We help teams identify where automation and machine learning can improve a workflow. We work from the problem and available data to a solution that can be evaluated and maintained.',
 '{"offerings":["Workflow automation","Machine learning applications","Business intelligence and reporting"],"benefits":["Reduce repetitive work","Use data to make operational decisions","Test solutions against clear requirements"]}',1,true),
('service','advanced-networking','Advanced Networking','Enterprise networks, wireless connectivity and infrastructure deployment.',
 'We plan and configure networks for the environments where they will be used. Work can cover routing, switching, access points, structured connectivity and troubleshooting.',
 '{"offerings":["Routing and switching","Wireless network design","Infrastructure deployment and troubleshooting"],"benefits":["Clearer network documentation","Reliable coverage and connectivity","A design that can grow with your site"]}',2,true),
('service','web-mobile-design','Web & Mobile Design','Websites and applications designed for real people and business workflows.',
 'We design and develop websites, web applications and mobile experiences. Projects begin with the problem, audience and content, then move through design, engineering and handover.',
 '{"offerings":["Website and application development","Responsive UI and UX design","Workflow and platform integration"],"benefits":["A usable experience on phones and desktops","Clear technical handover","Tools built around how your team works"]}',3,true),
('service','hajj-umrah','Hajj & Umrah Services','Digital travel support and booking assistance for pilgrimage planning.',
 'We help travellers organise information and navigate booking enquiries for Hajj and Umrah. Ask the team to confirm availability, the service scope and applicable terms before paying.',
 '{"offerings":["Travel planning support","Booking assistance","Digital enquiry and coordination"],"benefits":["Clear next steps","Better organised travel information","Support with booking enquiries"]}',4,true),
('service','forex-crypto-meetups','Forex & Crypto Meetups','Financial-market education and community learning sessions.',
 'Our meetups provide a setting to discuss fundamental and technical analysis, market structure, risk and trading discipline. Sessions are educational and do not constitute investment advice.',
 '{"offerings":["Forex and crypto learning sessions","Technical analysis discussions","Community meetups"],"benefits":["Practice reading market data","Discuss risk and decision-making","Learn with other participants"]}',5,true),
('service','starlink','Starlink','Installation, configuration and network integration for Starlink equipment.',
 'We help clients plan the placement of Starlink equipment, configure connectivity and integrate the connection with existing routers, switches or Wi-Fi. We work independently with customer equipment.',
 '{"offerings":["Installation and configuration","Router and Wi-Fi integration","Connectivity troubleshooting"],"benefits":["A site-appropriate installation","Integration with your existing network","Clear guidance on operation and support"]}',6,true),
('service','interior-design','Interior Design','Space planning and contemporary concepts for homes and businesses.',
 'We work with clients to define how a room should function, then develop a layout and visual direction around the space, users and budget.',
 '{"offerings":["Residential and commercial space planning","Interior concepts and finishes","Furniture and layout guidance"],"benefits":["Better use of available space","A consistent visual direction","A plan informed by how the space will be used"]}',7,true),
('service','consultation','Consultation','Technology advice that helps teams scope decisions and plan implementation.',
 'We help clients assess their current systems, clarify their requirements and choose practical next steps for digital and infrastructure projects.',
 '{"offerings":["IT and technology advisory","Digital strategy and requirements","Project scoping and implementation planning"],"benefits":["Clearer project priorities","An informed view of costs and constraints","A practical implementation roadmap"]}',8,true),
('faq','how-to-apply','How do I apply for training?','Create a student account, confirm your email and select a course. You can follow your application from your dashboard.','','{}',1,true),
('faq','payment-options','What payment options are available?','Choose Flutterwave online checkout, cash at the training centre or bank transfer. The dashboard shows the next step once your application is approved.','','{}',2,true),
('faq','course-dates','Where can I find class dates?','Confirmed dates, duration, batch details and availability appear on each course page. Ask the centre if a schedule is still pending.','','{}',3,true),
('faq','contact-centre','Where is the training centre?','Office No. 14, Mangal Plaza, Opposite Water Board, Katsina State, Nigeria. Call or WhatsApp +234 906 341 2927 for directions.','','{}',4,true),
('announcement','academy-registration','Applications for professional training',
 'Explore the networking and forex training tracks and follow your application in the student portal.',
 '', '{"href":"/training"}', 1,true);

insert into public.courses(slug,title,category,summary,description,objectives,requirements,faq,accent,cover_url,published,registrations_open,fee_kobo)
values
('networking-infrastructure','Computer Networking & IT Infrastructure','Networking',
 'Build practical networking skills for today’s digital infrastructure.',
 'Develop a foundation in network configuration and troubleshooting. Work through addressing, switching, routing and deployment concepts that apply to real network environments.',
 array['Plan IP addressing and subnetting','Configure and troubleshoot core network components','Apply basic security and deployment practices'],
 'Bring an interest in IT infrastructure. Contact the centre for confirmed equipment and any batch-specific requirements.',
 'Does this confer CCNA certification? The course covers CCNA concepts and practical networking. Any external certification requirements are separate.',
 'blue','/media/networking.webp',true,true,10000000),
('forex-financial-markets','Forex Trading & Financial Markets','Financial Markets',
 'Read forex charts, understand market behaviour, and build a trading plan.',
 'Learn how forex markets work, study fundamental and technical analysis, and practise approaching a trade with a defined risk plan.',
 array['Explain currency pairs and market structure','Interpret fundamentals and price charts','Define position sizing and a structured trading plan'],
 'Bring an interest in financial markets. Contact the centre for any batch-specific requirements.',
 'Does the course guarantee returns? Trading involves financial risk. This course is educational and does not provide investment advice or guarantee profits.',
 'gold','/media/forex.webp',true,true,10000000);

insert into public.course_modules(course_id,position,title,description)
select c.id,v.pos,v.title,v.description from (values
('networking-infrastructure',1,'Networking fundamentals','Understand network components, common models and CCNA concepts.'),
('networking-infrastructure',2,'IP addressing & subnetting','Plan IPv4 addressing and practice dividing a network into subnets.'),
('networking-infrastructure',3,'Routing & switching','Study how traffic moves within and between networks.'),
('networking-infrastructure',4,'Configuration & troubleshooting','Practise configuration and methodical fault isolation.'),
('networking-infrastructure',5,'Wireless networking & infrastructure','Plan connectivity and assess coverage and capacity.'),
('networking-infrastructure',6,'Security & deployment','Apply security fundamentals and plan practical deployment.'),
('forex-financial-markets',1,'Forex & currency pairs','Learn what currency pairs represent and how forex markets operate.'),
('forex-financial-markets',2,'Candlesticks & market structure','Identify common patterns and market structure on price charts.'),
('forex-financial-markets',3,'Fundamental analysis','Study how economic events and policy decisions can influence currencies.'),
('forex-financial-markets',4,'Technical analysis','Use support, resistance and trends to analyse price action.'),
('forex-financial-markets',5,'Risk management & position sizing','Define risk per trade and practise sizing positions.'),
('forex-financial-markets',6,'Trading psychology & strategy','Build a repeatable trading plan and reflect on discipline.')
) as v(slug,pos,title,description) join public.courses c on c.slug=v.slug;

insert into public.discounts(course_id,label,kind,value,claim_limit,active)
select id,'Early bird registration','percent',20,5,true
from public.courses where slug in ('networking-infrastructure','forex-financial-markets');
