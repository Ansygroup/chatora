# Chatora MCP — تنفيذ محلي

خادم MCP معزول داخل `mcp/`، مبني على TypeScript SDK الرسمي لـMCP v2 (JavaScript ESM) وNode.js 20+. يقدّم محتوى الموقع العام وبيانات مساحة عمل المستخدم المصادَق عليها وأفعالًا محدودة، عبر **STDIO** و**Streamable HTTP**.

> **حدود التنفيذ:** التنفيذ والاختبارات محلية فقط. لم يُنشر الخادم، ولم تُشغّل migration، ولم تُجرَ مكالمة إلى Supabase/Meta حقيقيين. أُضيف وضع OAuth اختياري كـresource-server scaffold، لكنه غير مفعّل ولم تُغيّر إعدادات Supabase Dashboard؛ الاختبارات تستخدم mock محليًا ولا تنفّذ OAuth consent أو authorization code flow.

## الأدوات

### صفحات عامة — بلا تسجيل دخول

- `search_public_site`: بحث في ملفات HTML المنشورة محليًا والموجودة في `sitemap.xml` فقط.
- `get_public_page`: قراءة نص صفحة عامة مفهرسة. `/login.html` و`/app.html` والصفحات الخاصة مستثناة لأنّها ليست في sitemap.

### بيانات مساحة العمل — رمز مستخدم Supabase مطلوب

- `get_workspace_summary`
- `list_contacts`
- `list_flows` — تعرض حتى 10 خطوات لكل تدفق لتقليل حجم النتائج.
- `get_flow_draft` — يعيد المسودة المدعومة كاملةً حتى 25 خطوة قبل تعديلها؛ يرفض تنسيقًا غير معروف بدل المخاطرة بفقد بيانات.
- `list_conversations`
- `get_conversation_messages` — يقرأ نصوص رسائل العملاء الخاصة عند طلب الأداة صراحةً.

كل استعلام يمرّر **JWT المستخدم نفسه** إلى Supabase مع المفتاح العام `anon/publishable`، ويقيّد مساحة العمل بملكية `workspaces.owner = auth.uid()` ثم يقيّد السجلات التابعة بـ`workspace_id` المملوك. لا يوجد `service_role` في الخادم، ولا يتجاوز الخادم سياسات RLS. يُرفض مفتاح JWT المعروف بدور `service_role`.

### أفعال محدودة — رمز مستخدم Supabase مطلوب

- `rename_workspace`
- `create_contact` — لا يبدأ محادثة ولا يرسل رسالة.
- `create_flow_draft` و`update_flow_draft` — المسودات فقط؛ لا تفعيل أو تشغيل.
- `set_conversation_status` — فتح/إغلاق محادثة فقط.

لا توجد أدوات حذف أو بث أو إرسال رسائل أو ربط Meta أو تفعيل الأتمتة. خطوات الرسائل الافتراضية في مسودة التدفق نصوص توضيحية فقط.

## الإعداد

1. من هذا المجلد نفّذ `npm ci`.
2. جهّز اعتماد مستخدم محليًا فقط عند الحاجة إلى أدوات مساحة العمل. لم تُنسخ قيم مشروع Supabase من ملفات الموقع إلى MCP:

```sh
export SUPABASE_URL='https://<your-project>.supabase.co'
export SUPABASE_ANON_KEY='<public anon/publishable key>'
export CHATORA_ACCESS_TOKEN='<short-lived user access token>'
```

لـClaude Desktop يمكن نسخ `.env.example` إلى `.env` وإضافة القيم هناك:

```sh
cp .env.example .env
# حرّر .env محليًا، ثم:
chmod 600 .env
```

`launch.mjs` يقرأ محليًا هذه المفاتيح الثلاثة فقط، ويرفض ملفًا مفتوح الصلاحيات على macOS/Linux. احتفظ به خارج Git (وهو مُستثنى في `.gitignore`). لا تسجل قيم الأسرار في الإعدادات المشتركة.

`CHATORA_ACCESS_TOKEN` هو رمز دخول المستخدم الحالي من Supabase، وليس مفتاح `anon` وليس `service_role`. تعامل معه كسرّ. عند انتهائه حدّثه محليًا وأعد تشغيل خادم STDIO/عميل MCP. لا يوجد تجديد تلقائي في وضع STDIO/local bearer. الأدوات العامة تظل متاحة بلا token؛ أدوات مساحة العمل ترفض الوصول دونه.

## النقلان

### STDIO — الأنسب لتشغيل العميل المحلي

يشغّل العميل العملية مباشرةً؛ لا يفتح الخادم منفذ شبكة. الأمر الأساسي:

```sh
node /ABSOLUTE/PATH/chatora/mcp/server.mjs stdio
```

مثال Codex في `~/.codex/config.toml`، مع تمرير القيم من بيئة النظام بدل حفظها في الملف:

```toml
[mcp_servers.chatora]
command = "node"
args = ["/ABSOLUTE/PATH/chatora/mcp/server.mjs", "stdio"]
cwd = "/ABSOLUTE/PATH/chatora/mcp"
env_vars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "CHATORA_ACCESS_TOKEN"]
```

مثال Claude Code في `.mcp.json` (توسيع `${VAR}` يتم محليًا لدى Claude Code؛ لا تضع القيم الفعلية في ملف مشترك):

```json
{
  "mcpServers": {
    "chatora": {
      "type": "stdio",
      "command": "node",
      "args": ["/ABSOLUTE/PATH/chatora/mcp/server.mjs", "stdio"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}",
        "CHATORA_ACCESS_TOKEN": "${CHATORA_ACCESS_TOKEN}"
      }
    }
  }
}
```

### Claude Desktop

في Claude Desktop افتح **Settings → Developer → Edit Config** وأضف إلى `claude_desktop_config.json` (مع الحفاظ على أي إعدادات أخرى). استخدم مسارًا مطلقًا:

```json
{
  "mcpServers": {
    "chatora": {
      "command": "/ABSOLUTE/PATH/TO/node",
      "args": ["/ABSOLUTE/PATH/chatora/mcp/launch.mjs", "stdio"]
    }
  }
}
```

يقرأ `launch.mjs` الاعتماديات من `mcp/.env` دون وضعها في ملف إعداد Claude. المسارات أعلاه أمثلة؛ استخدم مكان Node الحقيقي على جهازك. بعد الحفظ أعد تشغيل Claude Desktop.

### VS Code

ملف `.vscode/mcp.json` (تنسيق VS Code المحلي يستخدم `servers`):

```json
{
  "servers": {
    "chatora": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/server.mjs", "stdio"],
      "cwd": "${workspaceFolder}/mcp",
      "envFile": "${workspaceFolder}/mcp/.env"
    }
  }
}
```

### Cursor

ملف `.cursor/mcp.json` (تنسيق Cursor يستخدم `mcpServers`):

```json
{
  "mcpServers": {
    "chatora": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp/launch.mjs", "stdio"]
    }
  }
}
```

في VS Code وCursor راجع إعدادات الثقة ووافق فقط على أدوات Chatora التي تتوقعها. لا تخلط تنسيق `servers` في `.vscode/mcp.json` مع `mcpServers` في إعداد Cursor أو الملفات المحمولة.

### Streamable HTTP — للعميل المحلي الذي يفضّل عنوان URL

شغّل الخادم في طرفية محلية بعد ضبط `SUPABASE_URL` و`SUPABASE_ANON_KEY` إذا كنت ستستخدم أدوات المساحة العمل:

```sh
npm run start:http
# endpoint: http://127.0.0.1:3333/mcp
# health:   http://127.0.0.1:3333/health
```

الخادم مربوط عمدًا بـ`127.0.0.1`، ويطبّق فحوص `Host` و`Origin` للحماية من DNS rebinding. في الوضع الافتراضي، الأدوات العامة لا تحتاج Bearer وأدوات مساحة العمل تحتاج `Authorization: Bearer <user access token>`. لا تربطه بـ`0.0.0.0` ولا تعرّضه للإنترنت في الوضع العادي. يوجد scaffold اختياري لـOAuth في HTTP فقط؛ افتراضيًا هو متوقف والـbind loopback. يسمح الكود بالـnon-loopback bind فقط مع OAuth، وresource URL بـHTTPS، وHost allowlist؛ لكنه لا ينهي TLS أو يضبط reverse proxy/firewall، لذا ليس جاهزًا للنشر العام. راجع [`OAUTH.md`](OAUTH.md) قبل أي اختبار OAuth.

مثال Codex في `config.toml` بعد تشغيل HTTP؛ خزّن الرمز في متغير بيئة محلي:

```toml
[mcp_servers.chatora_http]
url = "http://127.0.0.1:3333/mcp"
bearer_token_env_var = "CHATORA_ACCESS_TOKEN"
```

مثال Claude Code في إعداد محلي أو `.mcp.json` غير مُشارك:

```json
{
  "mcpServers": {
    "chatora_http": {
      "type": "http",
      "url": "http://127.0.0.1:3333/mcp",
      "headers": {
        "Authorization": "Bearer ${CHATORA_ACCESS_TOKEN}"
      }
    }
  }
}
```

لـCursor، ابدأ الخادم محليًا ثم استخدم `headers.Authorization` مع `${env:CHATORA_ACCESS_TOKEN}` في إعداد HTTP؛ لـVS Code المحلي استخدم `type: "http"` و`headers.Authorization` في `.vscode/mcp.json`، مع إدخال token بواسطة `inputs` ذات `password: true` بدل كتابته حرفيًا. صيغة إعداد VS Code وCursor مختلفة؛ راجع `OAUTH.md` إذا كنت تقصد OAuth عن بُعد، لا bearer محليًا.

## Supabase preflight — اتصال حي اختياري وصريح

`preflight.mjs` يقرأ اختياريًا `mcp/.env` عبر parser محلي محدود بالمفاتيح المسموحة، ولا ينفذ الملف كـshell؛ يتطلب صلاحيات `chmod 600` على macOS/Linux. بعد إعداد الملف، `npm run preflight:config` يفحص القيم محليًا فقط ولا يتصل. `npm run preflight:live` هو الأمر الصريح للاتصال الحي.

`preflight:live` يتصل فقط بعد تشغيله صراحةً: يتحقق من رمز المستخدم عبر Auth `GET /auth/v1/user`، يقرأ معرف/مالك workspaces المملوكة، ثم يطلب أعدادًا دقيقة بـ`HEAD` من `contacts`, `flows`, `conversations`. لا يقرأ الرسائل، ولا يطبع token أو معرفات/أسماء أو صفوف العملاء، ولا ينفّذ `POST/PATCH/DELETE`. لا يشغّله الاختبار الآلي ولا تم تشغيله في هذا التسليم. نجاحه لا يثبت أن RLS مفعّل على كل جدول؛ راجع السياسات الفعلية يدويًا. لا يغيّر Dashboard أو إعدادات Supabase.

## التحقق المحلي

```sh
npm run check
npm test
npm audit --omit=dev
```

الاختبارات تستخدم عميل MCP الرسمي وSupabase mock مربوطًا على loopback، وتغطي الصفحات العامة، منع الصفحات الخاصة والمسارات غير المسموحة، عمليات مساحة العمل، preflight بقراءات GET/HEAD فقط، STDIO وStreamable HTTP، تحديات OAuth/metadata محلية وفحص audience، ورفض الاعتمادات السرية/غير الصالحة، وفحوص `Host` و`Origin`. العدد الحالي **11 اختبارًا**؛ تشمل فحص parser ملف البيئة، ولا يتصل OAuth test بـSupabase أو يجري authorization code/consent flow.

الاختبارات لا تثبت وجود الجداول أو سياسات RLS الفعلية، ولا صلاحية جلسة مستخدم حقيقية. أي اتصال حي أو تفعيل OAuth في Dashboard أو نشر عن بُعد يظل خطوة منفصلة تتطلب موافقة صريحة ومراجعة أمنية.

## وثائق إعداد العملاء الرسمية

- [Claude Desktop — Local MCP servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers)
- [Claude Code — MCP](https://code.claude.com/docs/en/mcp)
- [VS Code — Add MCP servers](https://code.visualstudio.com/docs/agent-customization/mcp-servers) و[مرجع الإعداد](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
- [Cursor — MCP](https://cursor.com/docs/mcp)

