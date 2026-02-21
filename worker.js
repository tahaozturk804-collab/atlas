// worker.js (Kısaltılmış Kritik Kısımlar - Tamamını bununla değiştir)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

    const db = env.ATLAS_DB;
    const { pathname } = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

    // Tablo Getirme Yardımcısı
    const getT = async (t) => JSON.parse(await db.get(t) || "[]");
    const setT = async (t, v) => await db.put(t, JSON.stringify(v));

    try {
      // ÜRÜN EKLEME FİX
      if (pathname === "/api/add" && request.method === "POST") {
        const { table, data } = body;
        let list = await getT(table);
        data.id = data.id || crypto.randomUUID(); // Güvenli ID
        list.push(data);
        await setT(table, list);
        return new Response("Tamam", { headers: CORS_HEADERS });
      }

      // SATIN ALMA FİX
      if (pathname === "/buy-product" && request.method === "POST") {
        const { user, productId } = body;
        let users = await getT("users");
        let products = await getT("products");
        
        const uIdx = users.findIndex(u => u.username === user);
        const product = products.find(p => p.id === productId);

        if (uIdx === -1 || !product) return new Response("Hata: Kullanıcı veya Ürün yok", { status: 404, headers: CORS_HEADERS });
        
        const price = Number(product.price);
        if (users[uIdx].bakiye < price) return new Response("Yetersiz Bakiye!", { status: 400, headers: CORS_HEADERS });

        users[uIdx].bakiye -= price;
        await setT("users", users);
        return new Response("Başarılı", { headers: CORS_HEADERS });
      }

      // API: GET ALL (Tüm verileri çekme)
      if (pathname === "/api/get-all") {
        const data = {
          users: await getT("users"),
          products: await getT("products"),
          categories: await getT("categories"),
          tickets: await getT("tickets"),
          applies: await getT("applies"),
          roles: await getT("roles")
        };
        return new Response(JSON.stringify(data), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
      }

      // Diğer endpointler (login/register) aynı kalabilir...
    } catch (e) {
      return new Response(e.message, { status: 500, headers: CORS_HEADERS });
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  }
}
