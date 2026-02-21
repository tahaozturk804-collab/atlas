const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const textResponse = (text, status = 200) =>
  new Response(text, { status, headers: CORS_HEADERS });

const normalizeUser = (u) => ({
  username: u.username,
  bakiye: Number(u.bakiye || 0),
  role: u.role || "Oyuncu",
  email: u.email || "",
  status: u.status || "active",
  registerDate: u.registerDate || new Date().toLocaleString("tr-TR"),
  password: u.password || "",
  lastSeen: u.lastSeen || null,
  webMinutes: Number(u.webMinutes || 0),
  lastIp: u.lastIp || null,
});

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const db = env.ATLAS_DB;
    const { pathname } = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

    const getT = async (table) => JSON.parse((await db.get(table)) || "[]");
    const setT = async (table, value) => db.put(table, JSON.stringify(value));

    try {
      if (pathname === "/api/get-all") {
        return jsonResponse({
          users: await getT("users"),
          products: await getT("products"),
          categories: await getT("categories"),
          tickets: await getT("tickets"),
          applies: await getT("applies"),
          roles: await getT("roles"),
          coupons: await getT("coupons"),
          orders: await getT("orders"),
        });
      }

      if (pathname === "/register" && request.method === "POST") {
        const user = String(body.user || "").trim();
        const pass = String(body.pass || "");
        if (!user || !pass) return textResponse("Kullanıcı adı ve şifre zorunlu.", 400);

        const users = (await getT("users")).map(normalizeUser);
        if (users.some((u) => u.username.toLowerCase() === user.toLowerCase())) {
          return textResponse("Bu kullanıcı adı zaten kayıtlı.", 409);
        }

        users.push(
          normalizeUser({
            username: user,
            password: pass,
            bakiye: 0,
            role: "Oyuncu",
            registerDate: new Date().toLocaleString("tr-TR"),
          })
        );
        await setT("users", users);
        return textResponse("Kayıt başarılı");
      }

      if (pathname === "/login" && request.method === "POST") {
        const user = String(body.user || "").trim();
        const pass = String(body.pass || "");
        const users = (await getT("users")).map(normalizeUser);
        const found = users.find((u) => u.username === user);

        if (!found) return textResponse("Kullanıcı bulunamadı.", 404);
        if (found.status === "banned") return textResponse("Bu hesap engellenmiş.", 403);
        if (found.password !== pass) return textResponse("Şifre yanlış.", 401);

        return textResponse("Giriş başarılı");
      }

      if (pathname === "/get-profile" && request.method === "POST") {
        const user = String(body.user || "").trim();
        const users = (await getT("users")).map(normalizeUser);
        const found = users.find((u) => u.username === user);
        if (!found) return textResponse("Kullanıcı bulunamadı.", 404);

        const { password, ...safeUser } = found;
        return jsonResponse(safeUser);
      }

      if (pathname === "/update-security" && request.method === "POST") {
        const user = String(body.user || "").trim();
        const users = (await getT("users")).map(normalizeUser);
        const idx = users.findIndex((u) => u.username === user);
        if (idx === -1) return textResponse("Kullanıcı bulunamadı.", 404);

        if (body.oldPass || body.newPass) {
          if (users[idx].password !== body.oldPass) return textResponse("Mevcut şifre yanlış.", 400);
          users[idx].password = String(body.newPass || "");
          if (!users[idx].password) return textResponse("Yeni şifre boş olamaz.", 400);
          await setT("users", users);
          return textResponse("Şifre güncellendi.");
        }

        if (body.newEmail) {
          users[idx].email = String(body.newEmail).trim();
          await setT("users", users);
          return textResponse("E-posta güncellendi.");
        }

        return textResponse("Geçersiz işlem.", 400);
      }

      if (pathname === "/update-online" && request.method === "POST") {
        const user = String(body.user || "").trim();
        if (!user) return textResponse("Eksik kullanıcı.", 400);

        const users = (await getT("users")).map(normalizeUser);
        const idx = users.findIndex((u) => u.username === user);
        if (idx === -1) return textResponse("Kullanıcı bulunamadı.", 404);

        const now = Date.now();
        const prev = users[idx].lastSeen ? new Date(users[idx].lastSeen).getTime() : null;
        if (prev && now - prev > 30_000) users[idx].webMinutes += 1;

        users[idx].lastSeen = new Date(now).toISOString();
        users[idx].lastIp = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || null;
        await setT("users", users);

        return textResponse("Online güncellendi");
      }

      if (pathname === "/api/add" && request.method === "POST") {
        const { table, data } = body;
        if (!table || !data) return textResponse("Eksik veri", 400);
        const list = await getT(table);
        const row = { ...data, id: data.id || crypto.randomUUID() };
        list.push(row);
        await setT(table, list);
        return textResponse("Tamam");
      }

      if (pathname === "/api/update" && request.method === "POST") {
        const { table, id, updates } = body;
        if (!table || !id || !updates) return textResponse("Eksik veri", 400);
        const list = await getT(table);
        const idx = list.findIndex((x) => String(x.id) === String(id));
        if (idx === -1) return textResponse("Kayıt bulunamadı", 404);

        list[idx] = { ...list[idx], ...updates };
        await setT(table, list);
        return textResponse("Güncellendi");
      }

      if (pathname === "/api/delete" && request.method === "POST") {
        const { table, id } = body;
        if (!table || !id) return textResponse("Eksik veri", 400);
        const list = await getT(table);
        await setT(
          table,
 codex/review-and-fix-files-with-new-features-dwkxej
          list.filter((x) => {
            if (x && typeof x === "object") return String(x.id) !== String(id) && String(x.name || "") !== String(id);
            return String(x) !== String(id);
          })

          list.filter((x) => String(x.id) !== String(id))
 main
        );
        return textResponse("Silindi");
      }

      if (pathname === "/api/users/update" && request.method === "POST") {
        const { user, type, val } = body;
        const users = (await getT("users")).map(normalizeUser);
        const idx = users.findIndex((u) => u.username === user);
        if (idx === -1) return textResponse("Kullanıcı bulunamadı", 404);

        if (type === "fullUpdate" && val && typeof val === "object") {
          users[idx] = normalizeUser({ ...users[idx], ...val, username: users[idx].username });
        } else if (type === "bakiye") {
          users[idx].bakiye = Number(val || 0);
        } else {
          return textResponse("Geçersiz güncelleme tipi", 400);
        }

        await setT("users", users);
        return textResponse("Kullanıcı güncellendi");
      }

      if (pathname === "/submit-apply" && request.method === "POST") {
        const { user, content } = body;
        if (!user || !content) return textResponse("Eksik veri", 400);

        const applies = await getT("applies");
        applies.push({
          id: crypto.randomUUID(),
          user,
          content,
          status: "Bekliyor",
          adminReply: "",
          date: new Date().toLocaleString("tr-TR"),
        });
        await setT("applies", applies);
        return textResponse("Başvuru kaydedildi");
      }

      if (pathname === "/api/update-apply" && request.method === "POST") {
        const { id, status } = body;
        const applies = await getT("applies");
        const idx = applies.findIndex((a) => String(a.id) === String(id));
        if (idx === -1) return textResponse("Başvuru bulunamadı", 404);
        applies[idx].status = status || applies[idx].status;
        await setT("applies", applies);
        return textResponse("Başvuru güncellendi");
      }

      if (pathname === "/create-ticket" && request.method === "POST") {
        const { user, title, category, message } = body;
        if (!user || !title || !message) return textResponse("Eksik veri", 400);

        const tickets = await getT("tickets");
        tickets.push({
          id: crypto.randomUUID(),
          user,
          title,
          category: category || "Genel",
          status: "Açık",
          date: new Date().toLocaleString("tr-TR"),
          messages: [{ sender: user, text: message, date: new Date().toISOString() }],
        });
        await setT("tickets", tickets);
        return textResponse("Talep açıldı");
      }

      if (pathname === "/my-tickets" && request.method === "POST") {
        const { user } = body;
        const tickets = await getT("tickets");
        return jsonResponse(tickets.filter((t) => t.user === user));
      }

      if (pathname === "/reply-ticket" && request.method === "POST") {
        const { ticketId, sender, text, isAdmin } = body;
        if (!ticketId || !sender || !text) return textResponse("Eksik veri", 400);

        const tickets = await getT("tickets");
        const idx = tickets.findIndex((t) => String(t.id) === String(ticketId));
        if (idx === -1) return textResponse("Talep bulunamadı", 404);

        const ticket = tickets[idx];
        ticket.messages = Array.isArray(ticket.messages) ? ticket.messages : [];
        ticket.messages.push({ sender: isAdmin ? "Admin" : sender, text, date: new Date().toISOString() });
        if (ticket.status !== "Kapandı") ticket.status = "Açık";

        tickets[idx] = ticket;
        await setT("tickets", tickets);
        return textResponse("Yanıt eklendi");
      }

      if (pathname === "/cart/get" && request.method === "POST") {
        const { user } = body;
        if (!user) return textResponse("Eksik kullanıcı", 400);
        const carts = await getT("carts");
        const cart = carts.find((c) => c.user === user) || { user, items: [] };
        return jsonResponse({ items: cart.items || [] });
      }

      if (pathname === "/cart/add" && request.method === "POST") {
        const { user, productId, quantity } = body;
        if (!user || !productId) return textResponse("Eksik veri", 400);

        const carts = await getT("carts");
        let cart = carts.find((c) => c.user === user);
        if (!cart) {
          cart = { user, items: [] };
          carts.push(cart);
        }

        const idx = cart.items.findIndex((i) => String(i.productId) === String(productId));
        if (idx === -1) {
          cart.items.push({ productId, quantity: Number(quantity || 1) });
        } else {
          cart.items[idx].quantity = Number(cart.items[idx].quantity || 1) + Number(quantity || 1);
        }

        await setT("carts", carts);
        return textResponse("Sepete eklendi");
      }

      if (pathname === "/cart/remove" && request.method === "POST") {
        const { user, productId } = body;
        if (!user || !productId) return textResponse("Eksik veri", 400);

        const carts = await getT("carts");
        const cart = carts.find((c) => c.user === user);
        if (!cart) return textResponse("Sepet boş", 404);

        cart.items = (cart.items || []).filter((i) => String(i.productId) !== String(productId));
        await setT("carts", carts);
        return textResponse("Sepetten kaldırıldı");
      }

      if (pathname === "/checkout-cart" && request.method === "POST") {
        const { user, couponCode } = body;
        if (!user) return textResponse("Eksik kullanıcı", 400);

        const users = (await getT("users")).map(normalizeUser);
        const products = await getT("products");
        const carts = await getT("carts");
        const coupons = await getT("coupons");
        const orders = await getT("orders");

        const uIdx = users.findIndex((u) => u.username === user);
        if (uIdx === -1) return textResponse("Kullanıcı bulunamadı", 404);

        const cart = carts.find((c) => c.user === user);
        if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return textResponse("Sepet boş", 400);

        const total = cart.items.reduce((sum, item) => {
          const p = products.find((x) => String(x.id) === String(item.productId));
          return sum + (Number(p?.price || 0) * Number(item.quantity || 1));
        }, 0);

        let discount = 0;
        if (couponCode) {
          const now = Date.now();
          const coupon = coupons.find(
            (c) =>
              String(c.code || "").toUpperCase() === String(couponCode).toUpperCase() &&
              Number(c.limit || 0) > 0 &&
              (!c.expiry || new Date(c.expiry).getTime() >= now)
          );
          if (coupon) {
            discount = Math.floor((total * Number(coupon.discount || 0)) / 100);
            coupon.limit = Number(coupon.limit || 0) - 1;
            await setT("coupons", coupons);
          }
        }

        const finalTotal = Math.max(0, total - discount);
        if (Number(users[uIdx].bakiye || 0) < finalTotal) return textResponse("Yetersiz bakiye", 400);

        users[uIdx].bakiye = Number(users[uIdx].bakiye || 0) - finalTotal;
        await setT("users", users);

        cart.items = [];
        await setT("carts", carts);

        orders.push({
          id: crypto.randomUUID(),
          user,
          total,
          discount,
          finalTotal,
          date: new Date().toLocaleString("tr-TR"),
        });
        await setT("orders", orders);

        return jsonResponse({ ok: true, total: finalTotal, discount });
      }

      if (pathname === "/buy-product" && request.method === "POST") {
        const { user, productId } = body;
        const users = (await getT("users")).map(normalizeUser);
        const products = await getT("products");

        const uIdx = users.findIndex((u) => u.username === user);
        const product = products.find((p) => String(p.id) === String(productId));
        if (uIdx === -1 || !product) return textResponse("Hata: Kullanıcı veya Ürün yok", 404);

        const price = Number(product.price || 0);
        if (Number(users[uIdx].bakiye || 0) < price) return textResponse("Yetersiz Bakiye!", 400);

        users[uIdx].bakiye = Number(users[uIdx].bakiye || 0) - price;
        await setT("users", users);
        return textResponse("Başarılı");
      }
    } catch (error) {
      return textResponse(`Worker error: ${error.message}`, 500);
    }

    return textResponse("Not Found", 404);
  },
};
