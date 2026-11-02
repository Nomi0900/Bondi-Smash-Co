# Bondi Smash Co. | Deploy Guide (zero se)

Folder: `public/` (website + admin), `src/worker.js` (server/API), `wrangler.jsonc` (config).
Aap ka Cloudflare account GitHub se pehle se juda hai, naya account nahin banana.

## STEP 1: GitHub repo
1. github.com par login > **New repository** > naam `bondi-smash-co` > Private > Create.
2. **uploading an existing file** link dabayein. Is zip ko Extract karke andar ki cheezein (`public` folder, `src` folder, `wrangler.jsonc`, `README.md`) drag & drop karein > **Commit changes**.
   Check karein ke repo mein `public/index.html`, `src/worker.js` aur `wrangler.jsonc` nazar aa rahe hon.

## STEP 2: KV database banayen (Cloudflare)
1. dash.cloudflare.com > **Storage & Databases > KV** > **Create namespace** > naam `bondi-kv` > Add.
2. Namespace ki **ID copy** karein.
3. GitHub mein `wrangler.jsonc` kholein > pencil (edit) > `PASTE_KV_NAMESPACE_ID_HERE` ki jagah wo ID paste karein (quotes rahen) > **Commit**.

## STEP 3: Worker deploy (GitHub se)
1. Cloudflare > **Workers & Pages > Create application > Import a repository** (GitHub) > `bondi-smash-co` repo chunein.
2. **Project/Worker name `bondi-smash-co` hi rakhein** (wrangler.jsonc ke `name` se same hona zaroori hai).
3. Build command khali, Deploy command `npx wrangler deploy` (default) > **Save and Deploy**.
4. Kuch der baad aap ko link milega: `https://bondi-smash-co.<aap-ka-naam>.workers.dev`
(Cloudflare ke buttons ke naam thore badal sakte hain, matlab wohi rahta hai.)

## STEP 4: Admin password (Secret)
Worker > **Settings > Variables and Secrets > Add** > Type **Secret** > Name `ADMIN_PASSWORD` > Value: apna mazboot password > **Deploy**.
Password kisi ko (mujhe bhi) na bhejein.

## STEP 5: Admin kholein
`https://<aap-ka-link>/admin` > password dalein.
- **Orders:** kanban board (New > Preparing > Ready > Done). Button ya drag & drop. Naya order aate hi beep.
- **Menu:** photo upload (khud 3:4 crop), price, SOLD OUT switch, hide, delete, upar/neeche.
- **Reviews:** approve karne par hi site par dikhta hai.
- **Settings:** naam, phone, WhatsApp, hours, address, delivery fee, minimum order, payment instructions, social links, ordering on/off.
- **CSV:** upar "CSV Orders" aur "CSV Reviews".

## STEP 6 (optional): Order alerts
Worker > Settings > Variables and Secrets (type **Secret**):
- **Telegram:** Telegram mein `@BotFather` > `/newbot` > token milega = `TELEGRAM_BOT_TOKEN`. Apne bot ko ek message bhejein, phir browser mein `https://api.telegram.org/bot<TOKEN>/getUpdates` kholein, wahan `"chat":{"id":...}` ka number = `TELEGRAM_CHAT_ID`.
- **Discord:** channel Settings > Integrations > Webhooks > New Webhook > Copy URL = `DISCORD_WEBHOOK_URL`.
Secret add karke **Deploy** dabayein.

## Placeholders jo aap ne badalne hain
| Kya | Kahan badlein |
|---|---|
| Brand name, phone, WhatsApp, address, hours, social links, payment instructions, delivery fee | Admin > **Settings** (code mein nahin) |
| Menu items, prices, photos | Admin > **Menu** |
| Page title / description | `public/index.html` ke `<head>` mein (PLACEHOLDER comment) |
| WhatsApp number format | sirf digits, jaise `61400000000` |

## Baad mein changes
GitHub mein file edit karke Commit karein, Cloudflare khud dobara deploy kar dega.

## Zaroori baatein
- KV "eventually consistent" hai: admin mein badlav kabhi kabhi doosri jagah ~1 minute mein dikhta hai.
- Password mazboot rakhein (lamba, unique). Login par thori der ka delay lagta hai, magar ye koi bari rate-limit nahin.
- Prices server par dobara calculate hote hain, customer browser se price badal nahin sakta.
- Payment online nahin hota: customer ko checkout par aap ki payment instructions dikhti hain.

## Masle
- `KV binding missing` > Step 2 mein ID paste nahin hui ya galat hai.
- Admin login par "ADMIN_PASSWORD secret set nahin" > Step 4 karein aur Deploy dabayein.
- Video na chale > poora `public/videos` folder GitHub par upload hona chahiye.
