# Chatora MCP — OAuth resource-server scaffold

**الحالة في 28 أكتوبر 2026: scaffold محلي اختياري فقط، غير مفعّل وغير منشور.** لم يُتصل بمشروع Supabase حقيقي، ولم تُغيّر إعدادات Dashboard أو Authorization Path أو DCR أو Site URL، ولم يُنشأ consent UI أو OAuth client. لا تُشغّل إعدادات OAuth الحية ولا تنشر الخادم دون تفويض صريح.

## ما أُضيف برمجيًا

عند تمرير خيار `oauth` إلى `startHttpServer` أو تشغيل HTTP مع `MCP_OAUTH_ENABLED=true`:

1. يكتشف الخادم metadata من `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`، ويتحقق أن issuer يطابق `SUPABASE_URL/auth/v1` وأن authorization/token endpoints من origin المشروع وأن PKCE `S256` معلن. يمكن حقن metadata محليًا للاختبارات؛ لا تحتاج الاختبارات إلى Supabase حي.
2. يخدم Protected Resource Metadata عند `/.well-known/oauth-protected-resource/mcp`، ويقدّم مرآة metadata لخادم التفويض على `/.well-known/oauth-authorization-server`، حسب primitives من MCP TypeScript SDK.
3. يطلب Bearer على **كل** طلبات MCP في وضع OAuth؛ يرد بتحدي `WWW-Authenticate` وresource metadata URL إذا غاب الرمز أو كان غير صالح.
4. يتحقق من الرمز عبر Supabase Auth `GET /auth/v1/user` باستخدام المفتاح العام، ثم يتطلب `exp` صالحًا و`aud` يطابق الجمهور المتوقع. الجمهور الافتراضي هو `MCP_RESOURCE_URL`، ويمكن تحديده صراحةً بـ`MCP_OAUTH_EXPECTED_AUDIENCE`. يستخدم هوية مستخدم Supabase في أدوات النطاق، ولا يستخدم `service_role`.

تُحلّل claims بعد تحقق Supabase لاستخدام `aud`, `exp`, `scope` و`client_id`. **لا يفرض scaffold scopes للتفويض على الأدوات**: قيم OIDC مثل `openid`, `email`, `profile` تصف معلومات الهوية، ولا تعني صلاحية قراءة/كتابة قاعدة البيانات. الأدوات التي توفرها خاضعة لحدود الخادم وملكية workspace وRLS. يجب أن تعرض واجهة الموافقة بدقة ما يستطيع MCP قراءته وتغييره، وألا توحي بأن scope الهوية هو تحكم صلاحيات قاعدة البيانات.

## متطلبات تفعيل Supabase OAuth الفعلي

قبل تجربة OAuth حقيقي يحتاج مالك المشروع إلى:

- تمكين OAuth 2.1 Server في Supabase Dashboard، بعد مراجعة أثر الإعداد على المشروع.
- تحديد Authorization Path في إعدادات OAuth Server.
- بناء/نشر واجهة موافقة تسجّل دخول المستخدم، تستدعي `getAuthorizationDetails(authorization_id)`، تعرض اسم العميل والصلاحيات المطلوبة وخيارات الموافقة/الرفض، وتستخدم `approveAuthorization` أو `denyAuthorization`، مع مسار إلغاء وصول واضح.
- اختيار DCR: إما تسجيل ديناميكي بعد تقييم مخاطره، أو تسجيل عميل عام مسبقًا. لا توجد هنا client IDs أو redirect URIs حقيقية، ولا تُخمن.
- التحقق على مشروع اختبار من أن access token الذي يصدره Supabase يحتوي `aud` مطابقًا تمامًا لقيمة `MCP_OAUTH_EXPECTED_AUDIENCE`. هذا الخادم يرفض رمزًا لا يحمل audience مطابقًا؛ لا تُعطّل الفحص لتجاوز الخطأ ولا تفترض أن `aud: authenticated` يكفي. لم يُضبط token hook أو إعداد إصدار claims ضمن هذا العمل.
- مراجعة جداول workspace وسياسات RLS واختبار كل قراءة وكتابة بحسابين مختلفين، ثم إضافة rate limits وTLS/reverse-proxy/Host-Origin policy ومراقبة مناسبة قبل أي استضافة عامة.

Supabase OAuth 2.1 يتطلب موافقة صريحة للمستخدم وواجهة authorization UI، كما أن Dynamic Client Registration اختياري. هذا لم يُفعّل هنا. راجع روابط Supabase الرسمية في المراجع أدناه قبل أي تعديل.

## إعدادات scaffold (لا تنفّذها تلقائيًا)

متغيرات HTTP لا تُحمّل تلقائيًا من `.env`; عيّنها في بيئة عملية الاختبار صراحةً. قيم المثال placeholders وليست إعدادات حقيقية:

```sh
export MCP_OAUTH_ENABLED=true
export MCP_RESOURCE_URL='http://127.0.0.1:3333/mcp'
export MCP_OAUTH_EXPECTED_AUDIENCE='http://127.0.0.1:3333/mcp'
export SUPABASE_URL='https://<project-ref>.supabase.co'
export SUPABASE_ANON_KEY='<public-anon-or-publishable-key>'
export MCP_HTTP_PORT=3333
node server.mjs http
```

**تشغيل هذا المثال يفتح اتصالًا حيًا إلى endpoint discovery في Supabase، وكل طلب MCP مصادق يستدعي Auth `GET /auth/v1/user`.** لم يُشغّل هذا المثال في إعداد هذه الملفات.

للاستضافة المستقبلية، يكون resource عادةً `https://<mcp-host>/mcp`. الوضع الافتراضي يظل مربوطًا بـ`127.0.0.1`. أُضيف خيار bind غير loopback مع حواجز fail-closed فقط عند تفعيل OAuth، واستخدام `MCP_RESOURCE_URL` بـHTTPS، والسماح صراحةً بـHost المناسب. يمكن ضبط `MCP_HTTP_HOST=0.0.0.0`, و`MCP_ALLOWED_HOSTS=<mcp-host>` (أسماء مضيفين فقط، بلا منفذ)، و`MCP_ALLOWED_ORIGINS=https://<trusted-client-origin>` (أصول كاملة مطابقة؛ اتركها فارغة إذا كان ينبغي رفض كل Origin موجود). هذا **لا** يضيف TLS أو proxy أو firewall؛ يجب إنهاء TLS في reverse proxy موثوق وتقييد الشبكة. `MCP_ALLOWED_ORIGINS` هو فحص Origin فقط ولا يضيف CORS response headers؛ دعم clients يعملون داخل browser يحتاج طبقة CORS منفصلة ومراجعة/اختبارًا. لا تستخدم URL عامًا في إعداد العميل قبل تجهيز كل ذلك ومراجعة الوصول. تغيير bind أو نشره ليس تفويضًا للإطلاق.

## اختبار محلي بلا Supabase حي

```sh
npm run check
npm test
```

اختبار OAuth يحقن AS metadata وJWT اصطناعيًا في خادم Supabase mock على loopback. يغطي metadata، وتحدي عدم وجود bearer، ورفض audience الخاطئ، وطلبًا مصادقًا تحت مستخدم mock. لا يختبر توقيع Supabase الحقيقي أو شاشة الموافقة أو تسجيل client أو code exchange أو refresh tokens. التحقق الحقيقي من التوقيع يظل مسؤولية Supabase Auth الذي يُستدعى في كل طلب.

## أمثلة عميل remote عند اكتمال الاستضافة والتفويض فقط

### VS Code — `.vscode/mcp.json`

إذا فعّل العميل تسجيل OAuth ديناميكيًا في المشروع:

```json
{
  "servers": {
    "chatora": {
      "type": "http",
      "url": "https://<mcp-host>/mcp"
    }
  }
}
```

لعميل مسجّل مسبقًا، استخدم إعداد VS Code OAuth `oauth.clientId` بقيمة عامة حقيقية يوفرها مالك Supabase:

```json
{
  "servers": {
    "chatora": {
      "type": "http",
      "url": "https://<mcp-host>/mcp",
      "oauth": { "clientId": "<registered-public-client-id>" }
    }
  }
}
```

### Cursor — `.cursor/mcp.json`

يكتشف Cursor protected-resource metadata ويستخدم OAuth/PKCE وفق دعم العميل. لا تضف credentials يدويًا إلى ملف مشترك:

```json
{
  "mcpServers": {
    "chatora": {
      "url": "https://<mcp-host>/mcp"
    }
  }
}
```

هذه أمثلة لتنسيق clients بعد استضافة endpoint وإعداد Supabase فقط؛ لا تعمل مع الإعداد الافتراضي المحلي، ولا تجعل scaffold وحده endpoint عامًا قابلًا للاستخدام. يلزم TLS/reverse proxy وإعدادات Supabase وموافقة إطلاق. Claude Desktop في دليل التشغيل مضبوط على STDIO محلي عبر `launch.mjs`؛ لا يوفّر هذا المستودع إعداد remote Claude Desktop جاهزًا.

## مراجع رسمية

- [Supabase — MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase — OAuth 2.1 Getting Started](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase — Token Security & RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [MCP TypeScript SDK — Authorization](https://ts.sdk.modelcontextprotocol.io/v2/serving/authorization.html)
- [VS Code — MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
- [Cursor — MCP](https://cursor.com/docs/mcp)
