/**
 * CWMNG CMS Worker
 * Cloudflare Workers + KV 存儲
 * 參照 e-corp 經驗：客戶留痕 + CMS 內容管理 + 簡易分析
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Cache-Control, Pragma, *",
      "Access-Control-Max-Age": "86400",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const routeKey = `${method} ${path}`;

      switch (routeKey) {
        case "GET /api/cms/data":
          return await getCMSData(env, corsHeaders);

        case "POST /api/cms/data":
          return await saveCMSData(request, env, corsHeaders);

        case "POST /api/inquiries":
          return await saveInquiry(request, env, corsHeaders);

        case "GET /api/inquiries":
        case "POST /api/inquiries/list":
          return await getInquiries(request, env, corsHeaders);

        case "PUT /api/inquiries":
          return await updateInquiry(request, env, corsHeaders);

        case "POST /api/analytics/pageview":
          return await handlePageView(request, env, corsHeaders);

        case "POST /api/analytics/interaction":
          return await handleInteraction(request, env, corsHeaders);

        case "POST /api/analytics/report":
          return await getAnalyticsReport(request, env, corsHeaders);

        case "POST /api/deploy":
          return await deployWebsite(request, env, corsHeaders);

        case "POST /api/auth":
          return await verifyAuth(request, env, corsHeaders);

        case "GET /":
          return jsonResponse({
            service: "CWMNG CMS API",
            version: "1.0.0",
            status: "running",
            endpoints: {
              "GET /api/cms/data": "獲取 CMS 內容",
              "POST /api/cms/data": "保存 CMS 內容（需密碼）",
              "POST /api/inquiries": "提交客戶查詢",
              "GET /api/inquiries": "獲取查詢列表（需密碼）",
              "PUT /api/inquiries": "更新查詢狀態（需密碼）",
              "POST /api/analytics/pageview": "記錄頁面瀏覽",
              "POST /api/analytics/interaction": "記錄用戶互動",
              "POST /api/analytics/report": "獲取分析報告（需密碼）",
              "POST /api/deploy": "觸發網站重新部署（需密碼）",
            }
          }, 200, corsHeaders);

        default:
          return jsonResponse({ success: false, error: "Not Found" }, 404, corsHeaders);
      }
    } catch (error) {
      console.error("[Worker Error]", error);
      return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
  },
};

// ==================== Auth Helper ====================

function requireAuth(requestBody, env) {
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    return { ok: false, error: "ADMIN_PASSWORD not configured" };
  }
  if (requestBody.password !== password) {
    return { ok: false, error: "Unauthorized" };
  }
  return { ok: true };
}

async function verifyAuth(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const auth = requireAuth(body, env);
    if (!auth.ok) {
      return jsonResponse({ success: false, error: auth.error }, 401, corsHeaders);
    }
    return jsonResponse({ success: true, message: "Authenticated" }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ success: false, error: "Invalid request" }, 400, corsHeaders);
  }
}

// ==================== CMS Handlers ====================

async function getCMSData(env, corsHeaders) {
  const data = await env.CMS_DATA.get("cms_data", "json");
  const defaults = getDefaultCMSData();
  if (!data) return jsonResponse(defaults, 200, corsHeaders);
  // 防止舊 KV 資料缺少新欄位導致「閃一下又消失」
  const merged = deepMerge(defaults, data);
  return jsonResponse(merged, 200, corsHeaders);
}

function deepMerge(defaults, stored) {
  if (Array.isArray(defaults)) {
    if (Array.isArray(stored)) {
      // 以 defaults 的長度為基準，補全 stored 中缺少的陣列元素
      return defaults.map((defItem, i) => {
        if (i in stored) {
          if (typeof defItem === 'object' && defItem !== null && typeof stored[i] === 'object' && stored[i] !== null) {
            return deepMerge(defItem, stored[i]);
          }
          return stored[i];
        }
        return defItem;
      });
    }
    return defaults;
  }
  if (typeof defaults === 'object' && defaults !== null && typeof stored === 'object' && stored !== null) {
    const result = {};
    for (const key of Object.keys(defaults)) {
      if (key in stored) {
        result[key] = deepMerge(defaults[key], stored[key]);
      } else {
        result[key] = defaults[key];
      }
    }
    for (const key of Object.keys(stored)) {
      if (!(key in result)) {
        result[key] = stored[key];
      }
    }
    return result;
  }
  return stored;
}

async function saveCMSData(request, env, corsHeaders) {
  const body = await request.json();
  const auth = requireAuth(body, env);
  if (!auth.ok) {
    return jsonResponse({ success: false, error: auth.error }, 401, corsHeaders);
  }

  const dataToSave = {
    ...body.data,
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
  };

  await env.CMS_DATA.put("cms_data", JSON.stringify(dataToSave));

  // 保存歷史記錄（30 天後過期）
  const timestamp = new Date().toISOString();
  await env.CMS_DATA.put(`cms_history_${timestamp}`, JSON.stringify(dataToSave), {
    expirationTtl: 86400 * 30,
  });

  return jsonResponse({ success: true, message: "CMS data saved", timestamp }, 200, corsHeaders);
}

// ==================== Inquiry Handlers ====================

async function saveInquiry(request, env, corsHeaders) {
  const data = await request.json();

  // 驗證必填
  if (!data.name || !data.phone) {
    return jsonResponse({ success: false, error: "姓名和電話為必填項" }, 400, corsHeaders);
  }

  const inquiryId = `inquiry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const inquiryData = {
    id: inquiryId,
    name: data.name,
    phone: data.phone,
    email: data.email || "",
    company: data.company || "",
    monthlyRevenue: data.monthlyRevenue || "",
    interest: data.interest || "一般查詢",
    message: data.message || "",
    source: data.source || "website",
    submittedAt: new Date().toISOString(),
    status: "pending",
    notes: "",
  };

  await env.CMS_DATA.put(inquiryId, JSON.stringify(inquiryData));

  return jsonResponse({
    success: true,
    message: "查詢記錄已保存",
    data: { inquiryId },
    timestamp: new Date().toISOString(),
  }, 200, corsHeaders);
}

async function getInquiries(request, env, corsHeaders) {
  const body = await request.json().catch(() => ({}));
  const auth = requireAuth(body, env);
  if (!auth.ok) {
    return jsonResponse({ success: false, error: auth.error }, 401, corsHeaders);
  }

  const { keys } = await env.CMS_DATA.list({ prefix: "inquiry_" });
  const inquiries = [];
  for (const key of keys) {
    const data = await env.CMS_DATA.get(key.name);
    if (data) inquiries.push(JSON.parse(data));
  }

  inquiries.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return jsonResponse({ success: true, data: inquiries, count: inquiries.length }, 200, corsHeaders);
}

async function updateInquiry(request, env, corsHeaders) {
  const body = await request.json();
  const auth = requireAuth(body, env);
  if (!auth.ok) {
    return jsonResponse({ success: false, error: auth.error }, 401, corsHeaders);
  }

  const { id, status, notes } = body;
  if (!id) {
    return jsonResponse({ success: false, error: "Inquiry ID is required" }, 400, corsHeaders);
  }

  const existing = await env.CMS_DATA.get(id);
  if (!existing) {
    return jsonResponse({ success: false, error: "Inquiry not found" }, 404, corsHeaders);
  }

  const inquiry = JSON.parse(existing);
  if (status) inquiry.status = status;
  if (notes !== undefined) inquiry.notes = notes;
  inquiry.updatedAt = new Date().toISOString();

  await env.CMS_DATA.put(id, JSON.stringify(inquiry));

  return jsonResponse({ success: true, data: inquiry }, 200, corsHeaders);
}

// ==================== Analytics Handlers ====================

async function handlePageView(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const country = request.headers.get("CF-IPCountry") || "unknown";
    const record = {
      type: "pageview",
      page: data.page || "/",
      referrer: data.referrer || "",
      userAgent: data.userAgent || request.headers.get("User-Agent") || "",
      country,
      sessionId: data.sessionId || "",
      timestamp: new Date().toISOString(),
    };
    const key = `analytics_pv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await env.CMS_DATA.put(key, JSON.stringify(record), { expirationTtl: 86400 * 90 });
    return jsonResponse({ success: true }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500, corsHeaders);
  }
}

async function handleInteraction(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const record = {
      type: "interaction",
      interactionType: data.type || "click",
      element: data.element || "",
      page: data.page || "/",
      value: data.value || "",
      sessionId: data.sessionId || "",
      timestamp: new Date().toISOString(),
    };
    const key = `analytics_int_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await env.CMS_DATA.put(key, JSON.stringify(record), { expirationTtl: 86400 * 90 });
    return jsonResponse({ success: true }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500, corsHeaders);
  }
}

async function getAnalyticsReport(request, env, corsHeaders) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = requireAuth(body, env);
    if (!auth.ok) {
      return jsonResponse({ success: false, error: auth.error }, 401, corsHeaders);
    }
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "7", 10);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    // List all analytics keys (up to 1000)
    const { keys } = await env.CMS_DATA.list({ prefix: "analytics_" });
    let pageViews = 0;
    let interactions = 0;
    const pageCounts = {};
    const sessions = new Set();

    // KV list maxes at 1000 keys per call; for small sites this is plenty
    for (const key of keys) {
      const raw = await env.CMS_DATA.get(key.name);
      if (!raw) continue;
      try {
        const record = JSON.parse(raw);
        if (record.timestamp && record.timestamp < cutoff) continue;
        if (record.type === "pageview") {
          pageViews++;
          pageCounts[record.page || "/"] = (pageCounts[record.page || "/"] || 0) + 1;
          if (record.sessionId) sessions.add(record.sessionId);
        } else if (record.type === "interaction") {
          interactions++;
          if (record.sessionId) sessions.add(record.sessionId);
        }
      } catch (e) {}
    }

    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page, count]) => ({ page, count }));

    return jsonResponse({
      success: true,
      data: {
        pageViews,
        interactions,
        sessions: sessions.size,
        topPages,
        days,
      },
    }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ success: false, error: e.message }, 500, corsHeaders);
  }
}

// ==================== Deploy Handler ====================

async function deployWebsite(request, env, corsHeaders) {
  const body = await request.json();
  const auth = requireAuth(body, env);
  if (!auth.ok) {
    return jsonResponse({ success: false, error: auth.error }, 401, corsHeaders);
  }

  const githubToken = env.GITHUB_TOKEN;
  const githubRepo = env.GITHUB_REPO || "twmeric/cwmng";

  if (!githubToken) {
    return jsonResponse({ success: false, error: "GITHUB_TOKEN not configured" }, 500, corsHeaders);
  }

  const resp = await fetch(
    `https://api.github.com/repos/${githubRepo}/actions/workflows/deploy.yml/dispatches`,
    {
      method: "POST",
      headers: {
        "Authorization": `token ${githubToken}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "CWMNG-CMS-Worker",
      },
      body: JSON.stringify({
        ref: "master",
        inputs: {
          reason: `CMS deploy triggered from admin - ${new Date().toISOString()}`,
        },
      }),
    }
  );

  if (resp.status === 204) {
    return jsonResponse({ success: true, message: "Deployment triggered" }, 200, corsHeaders);
  }

  let errorMsg = `GitHub API returned ${resp.status}`;
  try {
    const err = await resp.json();
    errorMsg = err.message || errorMsg;
  } catch (e) {}

  return jsonResponse({ success: false, error: errorMsg }, 500, corsHeaders);
}

// ==================== Helpers ====================

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      ...corsHeaders,
    },
  });
}

function getDefaultCMSData() {
  return {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    site: {
      title: "香港支付閘道 | 駿匯聯 C&W Management | 銀聯商務官方代理",
      description: "駿匯聯 C&W Management 是銀聯商務香港官方代理，提供比 Xtripe / XayPal 更優惠的線上支付閘道。本地信用卡費率低至 2.6%，AI 智能客服 7x24 待命，支援銀聯卡、微信支付、支付寶及 FPS 轉數快。",
      whatsappNumber: "85251164453",
      phoneDisplay: "+852 3987 1078",
      email: "info@cwmanagement.com.hk",
    },
    nav: {
      items: [
        { text: "服務方案", href: "#solutions" },
        { text: "價格對比", href: "#pricing" },
        { text: "客戶見證", href: "#trust" },
        { text: "常見問題", href: "#faq" },
      ],
      cta: "立即諮詢",
    },
    stickyCta: {
      text: "立即諮詢，獲取專屬優惠報價",
      button: "立即諮詢",
    },
    modals: {
      lead: {
        title: "獲取專屬優惠報價",
        description: "留下資料，我們的支付顧問會在 5 分鐘內透過 WhatsApp 聯絡你。",
        submitButton: "開始對話",
        note: "無需綁約，隨時可取消。",
        placeholders: {
          name: "稱呼（例如：陳先生）",
          phone: "WhatsApp 電話號碼",
          email: "電郵地址",
          company: "公司名稱（選填）",
          monthlyRevenue: "每月交易額（選填）",
        },
        revenueOptions: [
          { value: "", label: "每月交易額（選填）" },
          { value: "少於 $50,000", label: "少於 $50,000" },
          { value: "$50,000 - $200,000", label: "$50,000 - $200,000" },
          { value: "$200,000 - $500,000", label: "$200,000 - $500,000" },
          { value: "$500,000 以上", label: "$500,000 以上" },
        ],
      },
      checklist: {
        title: "免費索取《商戶申請文件清單》",
        description: "請留下 WhatsApp 號碼，我們會立即將文件清單傳送給你，並解答任何開戶疑問。",
        submitButton: "免費索取清單",
        note: "資料只會用於發送清單及跟進，絕不外洩。",
        placeholders: {
          name: "稱呼（例如：陳先生）",
          phone: "WhatsApp 電話號碼",
          email: "電郵地址（選填）",
          company: "公司名稱（選填）",
        },
      },
    },
    hero: {
      title: "每賣出一件貨，Xtripe 就先抽走你近 <span class='text-gradient'>4%</span> 利潤——<br><span class='text-gradient-red'>這筆隱形租金，你還要付多久？</span>",
      subtitle: "駿匯聯 —— 銀聯商務香港官方代理，專門幫本地網店把收款成本壓到 2.6% 以下。從對接到上線，有真人專員 + AI 客服全程跟進，讓你不再孤軍奮戰。",
      ctaPrimary: "立即免費諮詢",
      ctaSecondary: "查看詳細費率",
      stats: [
        { number: 2.6, suffix: "%", label: "本地信用卡費率" },
        { number: 0, suffix: "元", label: "月費 / 開戶費" },
      ],
      trustBadges: [
        { icon: "ph-seal-check", text: "銀聯商務香港官方代理" },
        { icon: "ph-users", text: "500+ 香港網店選用" },
        { icon: "ph-shield-check", text: "PCI DSS Level 1" },
      ],
    },
    quickLinks: [
      { icon: "ph-whatsapp-logo", text: "WhatsApp 索取申請清單", href: "#checklist", type: "modal_checklist" },
      { icon: "ph-calculator", text: "手續費計算機", href: "#pricing" },
      { icon: "ph-whatsapp-logo", text: "WhatsApp 直接查詢", href: "#contact" },
    ],
    problems: {
      sectionTitle: "大多數香港網店老闆沒發現：<br>自己的利潤正在這三個地方漏水",
      sectionSubtitle: "根據 2025 年香港電商調查，73% 網店認為手續費是最大營運壓力",
      items: [
        {
          icon: "💸",
          image: "images/textless/190514290-stroke.png",
          alt: "利潤被層層費用壓垮",
          title: "每筆交易的手續費，月尾就疊成一座山，把你的利潤壓到見底",
          description: "賣出 $1000，Xtripe / XayPal 先抽走 $35。營業額 $10 萬，手續費單就厚厚一疊，像這堆鞋盒一樣重——這筆錢本來可以用來請人、入貨，或者直接放進你的口袋。",
          solution: "我們的解決：統一 <strong>2.6%</strong>，無隱藏費用",
        },
        {
          icon: "⏰",
          image: "images/textless/230569377-stroke.png",
          alt: "交易出問題，腦子一片空白，無計可施",
          title: "交易出問題時，你只能夠一個人望天打掛",
          description: "突然之間被關閉，你急如熱鍋上的螞蟻，但客服永遠只有自動回覆。腦子一片空白，除了望天打卦，你什麼都做不了——訂單就這樣流失，信譽也跟著下滑。",
          solution: "我們的解決：AI 智能客服即時回應 + 真人專員跟進",
        },
        {
          icon: "🚫",
          image: "images/textless/242460541-stroke.png",
          alt: "內地市場遙遠如月球，缺一艘火箭",
          title: "內地客戶想買卻付不了錢，市場就像月球一樣遙遠",
          description: "內地遊客或跨境買家打開你的網站，卻發現沒有銀聯、沒有微信支付。購物車就這樣被遺棄，而你明知道這是一塊巨大的市場，卻像望著月球一樣——看得到，到不了。",
          solution: "我們的解決：銀聯卡 + 微信支付 + 支付寶，一網打盡",
        },
      ],
    },
    solutions: {
      sectionTitle: "三種方案，專為香港網店的真實場景設計",
      items: [
        {
          tag: "網店首選",
          title: "網店極速版",
          for: "適合：Shopify / WooCommerce / 自有網站",
          icon: "ph-shopping-bag",
          features: [
            { icon: "ph-shopping-cart", text: "一鍵結帳體驗，顯著減少顧客放棄購物車的比例" },
            { icon: "ph-rocket-launch", text: "Shopify / WooCommerce 即裝即用，對接後今晚就能開賣" },
            { icon: "ph-headset", text: "專人跟進上線" },
          ],
          priceNumber: "2.6",
          priceUnit: "% / 每筆",
          cta: "立即開通",
        },
        {
          tag: "訂閱制專用",
          title: "訂閱制服務版",
          for: "適合：SaaS、會員制、月費課程",
          icon: "ph-arrows-clockwise",
          featured: true,
          features: [
            { icon: "ph-arrows-clockwise", text: "自動扣款 + 智能重試，不再因付款失敗而無故流失會員" },
            { icon: "ph-chart-line-up", text: "減少流失率，提升 LTV" },
            { icon: "ph-bell", text: "自動提醒續費通知" },
          ],
          priceNumber: "2.2",
          priceUnit: "% / 每筆",
          priceNote: "量大再議",
          cta: "預約諮詢",
        },
        {
          tag: "跨境必備",
          title: "跨境電商版",
          for: "適合：面向內地 / 海外客戶",
          icon: "ph-globe-hemisphere-west",
          features: [
            { icon: "ph-currency-circle-dollar", text: "內地客戶用銀聯 / 微信 / 支付寶秒速付款，不再錯過跨境商機" },
            { icon: "ph-shield-check", text: "銀聯官方通道，資金合規安全" },
            { icon: "ph-globe-hemisphere-west", text: "覆蓋內地遊客 + 本地用戶" },
          ],
          priceNumber: "1.8",
          priceUnit: "% + 優惠匯率",
          cta: "獲取報價",
        },
      ],
    },
    process: {
      sectionTitle: "3 步開通，今天正規申請，往後安心收款",
      image: "images/textless/242354730-stroke.png",
      steps: [
        { num: "1", title: "提交文件", desc: "CI、BR 及銀行月結單，專員 1-2 天完成初審。" },
        { num: "2", title: "技術對接", desc: "提供 Shopify / WooCommerce 外掛或 API，最快 1 小時上線。" },
        { num: "3", title: "開始收款", desc: "T+1 自動結算，資金直接匯入你的香港戶口。" },
      ],
    },
    pricing: {
      sectionTitle: "算一算，你每年可以省多少？",
      sectionSubtitle: "超過 90% 輸入資料的店主發現，自己每年至少多付了 $30,000 手續費。看看你是不是其中之一。",
      resultLabel: "使用我們的服務，你每年可節省：",
      resultPlaceholder: "輸入交易額即可查看驚人差距",
      cta: "獲取這筆省下的費用 → 免費諮詢",
      comparisonRows: [
        { feature: "本地信用卡費率", us: "<strong>2.6%</strong>", xtripe: "3.4% + $2.35", xaypal: "3.9% + 固定費" },
        { feature: "月費", us: "<strong>$0</strong>", xtripe: "$0", xaypal: "$0" },
        { feature: "開戶費", us: "<strong>$0</strong>", xtripe: "$0", xaypal: "$0" },
        { feature: "銀聯卡支援", us: "<span class='badge badge-success'>✅ 原生支援</span>", xtripe: "<span class='badge badge-muted'>❌ 不支援</span>", xaypal: "<span class='badge badge-muted'>❌ 不支援</span>" },
        { feature: "FPS 轉數快", us: "<span class='badge badge-success'>✅ 0.8%</span>", xtripe: "<span class='badge badge-muted'>❌ 不支援</span>", xaypal: "<span class='badge badge-muted'>❌ 不支援</span>" },
        { feature: "AI 客服", us: "<span class='badge badge-success'>✅ 7x24 免費</span>", xtripe: "<span class='badge badge-muted'>❌ 郵件支援</span>", xaypal: "<span class='badge badge-muted'>❌ 郵件支援</span>" },
        { feature: "資金到帳", us: "<strong>T+1</strong>", xtripe: "T+7", xaypal: "T+3" },
      ],
    },
    downloadPromo: {
      image: "images/textless/134950753-stroke.png",
      alt: "申請文件清單",
      title: "準備開戶？先下載申請資料清單",
      subtitle: "我們為你整理了一份完整的商戶申請文件清單，讓你一次備齊，加快審批流程。",
      cta: "WhatsApp 免費索取清單",
    },
    trust: {
      sectionTitle: "銀聯官方背書，安全合規第一",
      sectionSubtitle: "我們團隊深耕香港支付市場多年，熟悉本地銀行、本地平台與本地消費者的付款習慣",
      badges: [
        { icon: "ph-seal-check", text: "銀聯商務<br>官方代理" },
        { icon: "ph-lock-key", text: "PCI DSS<br>Level 1" },
        { icon: "ph-bank", text: "香港金融管理局<br>合規" },
        { icon: "ph-shield-slash", text: "256 位<br>SSL 加密" },
      ],
      stats: [
        { value: 5000, suffix: "+", label: "已完成交易商戶" },
        { value: 99.9, suffix: "%", label: "系統穩定運行" },
        { value: 24, suffix: "hr", label: "專員即時回覆" },
        { value: 0, suffix: "", prefix: "$", label: "月費開通成本" },
      ],
    },
    testimonials: {
      sectionTitle: "與一眾香港網店同行，<br>選擇銀聯級的安全與信任",
      items: [
        { stars: 5, text: "轉用後第一個月就省了 $5,000 手續費。最難得的是，我終於不用為了一個技術問題，等 Xtripe 等兩天。", author: "陳先生", role: "3C 數碼網店店主" },
        { stars: 5, text: "加了銀聯和微信支付後，內地客戶的成交率提升了接近三成——這部分原本是完全流失掉的生意。", author: "林小姐", role: "美妝代購平台" },
        { stars: 5, text: "他們的技術專員直接進入我們後台協助對接，1 小時就搞定，比我們工程師自己摸索快得多。", author: "張先生", role: "SaaS 創辦人" },
      ],
    },
    marquee: [
      { icon: "ph-credit-card", text: "Visa / Mastercard" },
      { icon: "ph-bank", text: "銀聯卡" },
      { icon: "ph-wechat-logo", text: "微信支付" },
      { icon: "ph-alipay-logo", text: "支付寶" },
      { icon: "ph-arrows-left-right", text: "FPS 轉數快" },
      { icon: "ph-shield-check", text: "3D Secure 2.0" },
      { icon: "ph-lock-key", text: "PCI DSS Level 1" },
    ],
    faq: {
      sectionTitle: "常見問題",
      items: [
        {
          question: "開戶需要什麼文件？",
          answer: "一般只需提供香港公司註冊證（CI）、商業登記證（BR）及最近三個月的銀行月結單即可。我們的專員會在收到文件後 1-2 個工作天內完成初審。",
          ctaText: "文件齊全，立即免費開戶 →",
          ctaLink: "#checklist",
          ctaText2: "或 WhatsApp 直接查詢",
          ctaLink2: "https://wa.me/85251164453?text=你好，我想預約15分鐘諮詢。",
        },
        {
          question: "資金多久到帳？",
          answer: "我們提供 T+1 每日自動結算服務。交易成功後，資金將於下一個工作日直接匯入你的指定香港銀行帳戶，資金周轉更高效。",
        },
        {
          question: "支援哪些平台？",
          answer: "我們原生支援 Shopify、WooCommerce、OpenCart 等主流電商平台，同時提供完善的自有 API 文件，讓開發者可以輕鬆整合到任何網站或手機應用程式。",
          ctaText: "查看你的平台整合方式 →",
          ctaLink: "#contact",
        },
        {
          question: "如何處理退款？",
          answer: "商戶可透過管理後台進行一鍵退款操作，款項將原路退回至消費者的付款帳戶，且我們不會收取任何額外的退款手續費。",
        },
        {
          question: "交易安全嗎？",
          answer: "我們的系統通過 PCI DSS Level 1 最高級別安全認證，並全面支援 3D Secure 2.0 驗證，配合 256 位 SSL 加密傳輸，全方位保障每一筆交易安全。",
        },
      ],
    },
    cta: {
      image: "images/textless/156545017-stroke.png",
      alt: "滿意客戶",
      title: "本月限定：免費獲得價值 $3,000 的 API 對接收費",
      subtitle: "名額所剩無幾，額滿即恢復標準收費。立即鎖定你的專屬優惠，零風險開始：",
      benefits: [
        "專屬支付顧問 1 對 1 諮詢",
        "免費 API 對接與整合服務（價值 $3,000）",
      ],
      ctaPrimary: "立即免費開戶",
      ctaSecondary: "預約 15 分鐘諮詢",
      note: "只需 15 分鐘，你就能準確知道這個方案能為你的網店省多少——而這 15 分鐘，可能會改變你一整年的利潤。<br>無需綁約，隨時可取消。我們用服務留住你，不是合約。",
    },
    footer: {
      brandText: "駿匯聯 C&W Management Limited<br>Agency authorized by UnionPay Merchant Services (HK)",
      columns: [
        {
          title: "產品服務",
          links: [
            { text: "線上收款", href: "#solutions" },
            { text: "跨境支付", href: "#solutions" },
            { text: "AI 客服", href: "#solutions" },
          ],
        },
        {
          title: "支援中心",
          links: [
            { text: "WhatsApp 索取申請清單", href: "#checklist", type: "modal_checklist" },
            { text: "API 文檔", href: "#" },
            { text: "聯絡我們", href: "#contact" },
          ],
        },
        {
          title: "聯絡方式",
          contactLines: [
            { icon: "ph-phone", text: "3987 1078" },
            { icon: "ph-whatsapp-logo", text: "5116 4453" },
            { icon: "ph-envelope", text: "info@cwmanagement.com.hk" },
            { icon: "ph-map-pin", text: "香港新界荃灣青山公路264-298號南豐中心19樓1922室" },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} 駿匯聯有限公司 C&W Management Limited. 銀聯商務香港官方代理.`,
      poweredBy: "Powered by <a href='https://jkdcoding.com' target='_blank'><img src='images/jkd-logo.png' alt='jkdcoding.com' style='height:18px;width:auto;display:inline-block;vertical-align:middle;'></a>",
    },
    mediaLibrary: [
      { id: "media_1", name: "駿匯聯 Logo", url: "images/logo.png", type: "image", alt: "駿匯聯 C&W Management Logo" },
      { id: "media_2", name: "吉祥物 A - 邊行都啱", url: "images/textless/216808905A.png", type: "image", alt: "邊行都啱" },
      { id: "media_3", name: "吉祥物 B - 收咁貴", url: "images/textless/216808905B.png", type: "image", alt: "收咁貴" },
      { id: "media_4", name: "吉祥物 C - 你仲諗咩", url: "images/textless/216808905C.png", type: "image", alt: "你仲諗咩" },
    ],
  };
}
