const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_DB = {
  users: [],
  roles: [{ name: "Oyuncu" }, { name: "admin" }],
  categories: [],
  products: [],
  applies: [],
  tickets: [],
  coupons: [],
  orders: [],
  online_sessions: {},
};

const textResponse = (body, status = 200, extraHeaders = {}) =>
  new Response(body, { status, headers: { ...CORS_HEADERS, ...extraHeaders } });

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

async function getTable(db, table) {
  const value = await db.get(table, "json");
  if (value === null || value === undefined) {
    return DEFAULT_DB[table] ?? [];
  }
  return value;
}

async function putTable(db, table, value) {
  await db.put(table, JSON.stringify(value));
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    const db = env.ATLAS_DB;
    if (!db) return textResponse("ATLAS_DB tanımlı değil.", 500);

    const { pathname } = new URL(request.url);

    try {
      if (pathname === "/health") {
        return jsonResponse({ ok: true, service: "atlas-worker" });
      }

      if (pathname === "/register" && request.method === "POST") {
        const { user, pass } = await readJson(request);
        if (!user || !pass) return textResponse("Kullanıcı adı ve şifre zorunlu.", 400);

        const username = String(user).trim();
        if (username.length < 3) return textResponse("Kullanıcı adı en az 3 karakter olmalı.", 400);

        const users = await getTable(db, "users");
        if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
          return textResponse("Bu kullanıcı adı alınmış!", 400);
        }

        const joinedAt = new Date().toLocaleString("tr-TR");
        users.push({
          username,
          password: String(pass),
          bakiye: 0,
          role: "Oyuncu",
          email: "",
          joinedAt,
          registerDate: joinedAt,
          totalOnlineMinutes: 0,
          lastSeenAt: null,
        });

        await putTable(db, "users", users);
        return textResponse("Tamam", 200);
      }

      if (pathname === "/login" && request.method === "POST") {
        const { user, pass } = await readJson(request);
        if (!user || !pass) return textResponse("Kullanıcı adı ve şifre zorunlu.", 400);

        const users = await getTable(db, "users");
        const found = users.find((u) => u.username === user && u.password === pass);
        if (!found) return textResponse("Kullanıcı adı veya şifre hatalı!", 401);

        return jsonResponse({ ok: true, username: found.username, role: found.role });
      }

      if (pathname === "/api/get-all") {
        const data = {
          users: await getTable(db, "users"),
          roles: await getTable(db, "roles"),
          categories: await getTable(db, "categories"),
          products: await getTable(db, "products"),
          applies: await getTable(db, "applies"),
          tickets: await getTable(db, "tickets"),
          coupons: await getTable(db, "coupons"),
          orders: await getTable(db, "orders"),
        };
        return jsonResponse(data);
      }

      if (pathname === "/api/add" && request.method === "POST") {
        const { table, data } = await readJson(request);
        const allowedTables = ["products", "roles", "categories", "applies", "coupons", "orders"];
        if (!allowedTables.includes(table)) return textResponse("Geçersiz tablo.", 400);
        if (!data || typeof data !== "object") return textResponse("Eklenecek veri geçersiz.", 400);

        const list = await getTable(db, table);
        list.push(data);
        await putTable(db, table, list);
        return jsonResponse({ success: true });
      }

      if (pathname === "/api/users/update" && request.method === "POST") {
        const { user, type, val } = await readJson(request);
        if (!user) return textResponse("Kullanıcı adı zorunlu.", 400);

        const users = await getTable(db, "users");
        const idx = users.findIndex((u) => u.username === user);
        if (idx === -1) return textResponse("Kullanıcı bulunamadı.", 404);

        if (type === "fullUpdate" && val && typeof val === "object") {
          users[idx] = { ...users[idx], ...val };
        } else if (type) {
          users[idx] = { ...users[idx], [type]: val };
        } else {
          return textResponse("Güncelleme tipi zorunlu.", 400);
        }

        await putTable(db, "users", users);
        return jsonResponse({ success: true, user: users[idx] });
      }



      if (pathname === "/api/update" && request.method === "POST") {
        const { table, id, updates } = await readJson(request);
        const allowedTables = ["products", "applies", "tickets", "roles", "categories", "coupons", "orders"];
        if (!allowedTables.includes(table)) return textResponse("Geçersiz tablo.", 400);
        if (!id || !updates || typeof updates !== "object") return textResponse("Eksik güncelleme verisi.", 400);

        const list = await getTable(db, table);
        const idx = list.findIndex((x) => String(x.id) === String(id));
        if (idx === -1) return textResponse("Kayıt bulunamadı.", 404);

        list[idx] = { ...list[idx], ...updates };
        await putTable(db, table, list);
        return jsonResponse({ success: true, item: list[idx] });
      }

      if (pathname === "/api/delete" && request.method === "POST") {
        const { table, id } = await readJson(request);
        const allowedTables = ["products", "applies", "tickets", "roles", "categories", "coupons", "orders"];
        if (!allowedTables.includes(table)) return textResponse("Geçersiz tablo.", 400);
        if (!id) return textResponse("ID zorunlu.", 400);

        const list = await getTable(db, table);
        const newList = list.filter((x) => String(x.id) !== String(id));
        if (newList.length === list.length) return textResponse("Kayıt bulunamadı.", 404);

        await putTable(db, table, newList);
        return jsonResponse({ success: true });
      }
      if (pathname === "/submit-apply" && request.method === "POST") {
        const { user, content } = await readJson(request);
        if (!user || !content) return textResponse("Eksik başvuru bilgisi.", 400);

        const applies = await getTable(db, "applies");
        applies.push({
          id: crypto.randomUUID(),
          user,
          content,
          date: new Date().toLocaleString("tr-TR"),
          status: "Bekliyor",
        });

        await putTable(db, "applies", applies);
        return textResponse("Tamam", 200);
      }

      if (pathname === "/get-profile" && request.method === "POST") {
        const { user } = await readJson(request);
        const users = await getTable(db, "users");
        const found = users.find((u) => u.username === user);
        if (!found) return textResponse("Kullanıcı bulunamadı.", 404);

        return jsonResponse({
          username: found.username,
          bakiye: found.bakiye ?? 0,
          role: found.role ?? "Oyuncu",
          email: found.email ?? "",
          registerDate: found.registerDate || found.joinedAt || "Bilinmiyor",
        });
      }

      if (pathname === "/update-security" && request.method === "POST") {
        const { user, oldPass, newPass, newEmail } = await readJson(request);
        const users = await getTable(db, "users");
        const idx = users.findIndex((u) => u.username === user);
        if (idx === -1) return textResponse("Kullanıcı bulunamadı.", 404);

        if (newEmail !== undefined) {
          users[idx].email = String(newEmail).trim();
          await putTable(db, "users", users);
          return textResponse("E-posta güncellendi.", 200);
        }

        if (newPass !== undefined) {
          if (!oldPass || users[idx].password !== oldPass) return textResponse("Mevcut şifre yanlış.", 401);
          users[idx].password = String(newPass);
          await putTable(db, "users", users);
          return textResponse("Şifre güncellendi.", 200);
        }

        return textResponse("Güncellenecek alan yok.", 400);
      }

      if (pathname === "/update-online" && request.method === "POST") {
        const { user } = await readJson(request);
        if (!user) return textResponse("Kullanıcı adı zorunlu.", 400);

        const sessions = await getTable(db, "online_sessions");
        const now = Date.now();
        const previousSeen = sessions[user] || now;
        sessions[user] = now;
        await putTable(db, "online_sessions", sessions);

        const users = await getTable(db, "users");
        const idx = users.findIndex((u) => u.username === user);
        if (idx !== -1) {
          const minutes = Math.max(0, Math.floor((now - previousSeen) / 60000));
          users[idx].totalOnlineMinutes = (users[idx].totalOnlineMinutes || 0) + minutes;
          users[idx].lastSeenAt = new Date(now).toLocaleString("tr-TR");
          await putTable(db, "users", users);
        }

        return jsonResponse({ success: true });
      }

      if (pathname === "/create-ticket" && request.method === "POST") {
        const { user, title, category, message } = await readJson(request);
        if (!user || !title || !message) return textResponse("Eksik ticket bilgisi.", 400);

        const tickets = await getTable(db, "tickets");
        tickets.push({
          id: crypto.randomUUID(),
          user,
          title,
          category: category || "Genel",
          status: "Açık",
          date: new Date().toLocaleString("tr-TR"),
          messages: [{ sender: user, text: message, image: null, at: new Date().toISOString() }],
        });

        await putTable(db, "tickets", tickets);
        return jsonResponse({ success: true });
      }

      if (pathname === "/my-tickets" && request.method === "POST") {
        const { user } = await readJson(request);
        if (!user) return textResponse("Kullanıcı adı zorunlu.", 400);

        const tickets = await getTable(db, "tickets");
        return jsonResponse(tickets.filter((t) => t.user === user));
      }

      if (pathname === "/reply-ticket" && request.method === "POST") {
        const { ticketId, sender, text, image } = await readJson(request);
        if (!ticketId || !sender) return textResponse("Eksik yanıt bilgisi.", 400);

        const tickets = await getTable(db, "tickets");
        const idx = tickets.findIndex((t) => t.id === ticketId);
        if (idx === -1) return textResponse("Ticket bulunamadı.", 404);
        if (tickets[idx].status === "Kapandı") return textResponse("Kapalı ticket'a mesaj atılamaz.", 400);

        tickets[idx].messages.push({
          sender,
          text: text || "",
          image: image || null,
          at: new Date().toISOString(),
        });
        await putTable(db, "tickets", tickets);
        return jsonResponse({ success: true });
      }

      if (pathname === "/close-ticket" && request.method === "POST") {
        const { ticketId } = await readJson(request);
        if (!ticketId) return textResponse("Ticket ID zorunlu.", 400);

        const tickets = await getTable(db, "tickets");
        const idx = tickets.findIndex((t) => t.id === ticketId);
        if (idx === -1) return textResponse("Ticket bulunamadı.", 404);

        tickets[idx].status = "Kapandı";
        await putTable(db, "tickets", tickets);
        return jsonResponse({ success: true });
      }

      if (pathname === "/checkout-cart" && request.method === "POST") {
        const { user, items, couponCode } = await readJson(request);
        if (!user || !Array.isArray(items) || items.length === 0) {
          return textResponse("Kullanıcı ve sepet ürünleri zorunlu.", 400);
        }

        const users = await getTable(db, "users");
        const products = await getTable(db, "products");
        const coupons = await getTable(db, "coupons");
        const orders = await getTable(db, "orders");

        const userIdx = users.findIndex((u) => u.username === user);
        if (userIdx === -1) return textResponse("Kullanıcı bulunamadı.", 404);

        let subtotal = 0;
        const normalizedItems = [];

        for (const item of items) {
          const quantity = Math.max(1, Number(item.quantity) || 1);
          const product = products.find((p) => String(p.id) === String(item.productId));
          if (!product) return textResponse("Sepette geçersiz ürün var.", 400);

          const unitPrice = Number(product.price) || 0;
          subtotal += unitPrice * quantity;
          normalizedItems.push({
            productId: product.id,
            name: product.name,
            category: product.category || "Genel",
            unitPrice,
            quantity,
            total: unitPrice * quantity,
          });
        }

        let discount = 0;
        let couponInfo = null;
        if (couponCode) {
          const now = new Date();
          const normalizedCode = String(couponCode).trim().toUpperCase();
          const couponIdx = coupons.findIndex((c) =>
            String(c.code || "").trim().toUpperCase() === normalizedCode
          );
          if (couponIdx === -1) return textResponse("Kupon kodu bulunamadı.", 400);

          const coupon = coupons[couponIdx];
          const usedCount = Number(coupon.usedCount || 0);
          const limit = Number(coupon.limit || 0);
          if (limit > 0 && usedCount >= limit) return textResponse("Kupon kullanım limiti dolmuş.", 400);

          if (coupon.expiry && !Number.isNaN(new Date(coupon.expiry).getTime()) && now > new Date(coupon.expiry)) {
            return textResponse("Kuponun süresi dolmuş.", 400);
          }

          const rate = Math.min(100, Math.max(0, Number(coupon.discount) || 0));
          discount = Math.round((subtotal * rate) / 100);
          couponInfo = { code: coupon.code, discountRate: rate };

          coupons[couponIdx] = { ...coupon, usedCount: usedCount + 1 };
          await putTable(db, "coupons", coupons);
        }

        const total = Math.max(0, subtotal - discount);
        if ((users[userIdx].bakiye || 0) < total) return textResponse("Yetersiz bakiye.", 400);

        users[userIdx].bakiye = (users[userIdx].bakiye || 0) - total;
        await putTable(db, "users", users);

        orders.push({
          id: crypto.randomUUID(),
          user,
          items: normalizedItems,
          subtotal,
          discount,
          total,
          couponCode: couponInfo?.code || null,
          date: new Date().toLocaleString("tr-TR"),
        });
        await putTable(db, "orders", orders);

        return jsonResponse({
          success: true,
          bakiye: users[userIdx].bakiye,
          subtotal,
          discount,
          total,
          coupon: couponInfo,
        });
      }

      if (pathname === "/buy-product" && request.method === "POST") {
        const { user, productId } = await readJson(request);
        if (!user || !productId) return textResponse("Kullanıcı ve ürün bilgisi zorunlu.", 400);

        const users = await getTable(db, "users");
        const products = await getTable(db, "products");
        const userIdx = users.findIndex((u) => u.username === user);
        const product = products.find((p) => String(p.id) === String(productId));

        if (userIdx === -1) return textResponse("Kullanıcı bulunamadı.", 404);
        if (!product) return textResponse("Ürün bulunamadı.", 404);

        const price = Number(product.price) || 0;
        if ((users[userIdx].bakiye || 0) < price) return textResponse("Yetersiz bakiye.", 400);

        users[userIdx].bakiye = (users[userIdx].bakiye || 0) - price;
        await putTable(db, "users", users);

        return jsonResponse({ success: true, bakiye: users[userIdx].bakiye });
      }

      return textResponse("Not Found", 404);
    } catch (error) {
      return textResponse(`Server error: ${error.message}`, 500);
    }
  },
};
