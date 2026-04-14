/**
 * generate-pdf-v5.ts — Modern SaaS-style dental chatbot proposal PDF
 *
 * Clean, confident, young-startup vibe. Inter display headlines, electric
 * violet accent, rounded cards. Less editorial, more "this actually ships".
 *
 * Run: npx ts-node scripts/generate-pdf-v5.ts
 * Output: output/static/smartflowdev-dental-proposal-hu.pdf
 */

import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

const PAGE_W = 1280;
const PAGE_H = 720;
const OUT_DIR = path.resolve(__dirname, '../output/static');
const OUT_PATH = path.join(OUT_DIR, 'smartflowdev-dental-proposal-hu.pdf');

function buildHtml(): string {
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${PAGE_W}px ${PAGE_H}px; margin: 0; }

    :root {
      --bg: #FAFAFA;
      --card: #FFFFFF;
      --ink: #0A0A0A;
      --ink-soft: #27272A;
      --ink-muted: #71717A;
      --ink-subtle: #A1A1AA;
      --border: #E4E4E7;
      --border-soft: #F4F4F5;

      --accent: #6366F1;
      --accent-soft: #EEF2FF;
      --accent-dark: #4338CA;
      --accent-bright: #818CF8;

      --lime: #84CC16;
      --amber: #F59E0B;
      --rose: #F43F5E;
    }

    body {
      margin: 0; padding: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--ink);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-feature-settings: 'cv11','ss01','ss03';
    }

    .page {
      width: ${PAGE_W}px;
      height: ${PAGE_H}px;
      overflow: hidden;
      position: relative;
      page-break-after: always;
      page-break-inside: avoid;
      background: var(--bg);
    }
    .page:last-child { page-break-after: auto; }

    .display {
      font-family: 'Inter', sans-serif;
      font-weight: 800;
      letter-spacing: -2.5px;
      line-height: 0.95;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--accent-soft);
      color: var(--accent);
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }

    .pill-dot {
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: var(--ink);
      color: var(--bg);
      padding: 18px 32px;
      border-radius: 14px;
      font-weight: 600;
      font-size: 16px;
    }

    .gradient-text {
      background: linear-gradient(120deg, var(--accent) 0%, var(--accent-bright) 50%, var(--accent) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  `;

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════
  const page1 = `
    <div class="page" style="padding:60px 70px;background:var(--bg);">
      <!-- Top nav -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:80px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;background:var(--ink);border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <div style="width:14px;height:14px;background:var(--accent-bright);border-radius:3px;"></div>
          </div>
          <div style="font-size:16px;font-weight:700;letter-spacing:-0.3px;">smartflowdev</div>
        </div>
        <div style="font-size:12px;color:var(--ink-muted);">Ajánlat · 2026 április</div>
      </div>

      <!-- Pill -->
      <div class="pill" style="margin-bottom:32px;">
        <span class="pill-dot"></span>
        Fogorvosi praxisoknak
      </div>

      <!-- Massive headline -->
      <h1 class="display" style="font-size:108px;margin-bottom:28px;">
        Egy chatbot ami<br>
        az oldaladhoz<br>
        <span class="gradient-text">tartozik.</span>
      </h1>

      <!-- Subtitle -->
      <p style="font-size:21px;color:var(--ink-muted);max-width:640px;line-height:1.5;font-weight:400;margin-bottom:60px;">
        Egyedileg épített, a praxisod arculatához igazított AI chatbot és online foglalási rendszer — végponttól végpontig megépítve, 5 munkanap alatt élesben az oldaladon.
      </p>

      <!-- Bottom stats row -->
      <div style="display:flex;gap:48px;padding-top:32px;border-top:1px solid var(--border);">
        <div>
          <div style="font-size:36px;font-weight:800;letter-spacing:-1.5px;">24/7</div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Folyamatosan aktív</div>
        </div>
        <div>
          <div style="font-size:36px;font-weight:800;letter-spacing:-1.5px;">3×</div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Több foglalás</div>
        </div>
        <div>
          <div style="font-size:36px;font-weight:800;letter-spacing:-1.5px;">5</div>
          <div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Munkanap az élesedésig</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          <div style="font-size:12px;color:var(--ink-muted);margin-bottom:4px;">Készítette</div>
          <div style="font-size:14px;font-weight:600;">Geri · smartflowdev.com</div>
        </div>
      </div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 2 — WHAT WE DO
  // ═══════════════════════════════════════════════════════════════════
  const page2 = `
    <div class="page" style="padding:60px 70px;background:var(--bg);">
      <div class="pill" style="margin-bottom:24px;"><span class="pill-dot"></span>Amit csinálunk</div>

      <h2 class="display" style="font-size:72px;margin-bottom:20px;">
        Két dolog. <span style="color:var(--ink-muted);">Profin.</span>
      </h2>
      <p style="font-size:17px;color:var(--ink-muted);max-width:640px;line-height:1.55;margin-bottom:48px;">
        Nem alakítjuk át az egész weboldaladat. Csak hozzáadjuk ami hiányzik — anélkül hogy a meglévőhöz nyúlnánk.
      </p>

      <!-- Two feature cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <!-- Card 1: Chatbot -->
        <div class="card" style="padding:36px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:var(--accent-soft);border-radius:50%;"></div>

          <div style="position:relative;">
            <div style="width:52px;height:52px;background:var(--ink);border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>

            <h3 style="font-size:26px;font-weight:700;letter-spacing:-0.6px;margin-bottom:12px;">AI chatbot</h3>
            <p style="font-size:14px;color:var(--ink-muted);line-height:1.6;margin-bottom:20px;">
              A praxisod adataira tanítva — szolgáltatások, nyitvatartás, árak, GYIK. Páciens kérdésekre válaszol 24/7 és jelzi a sürgős eseteket.
            </p>

            <div style="display:flex;flex-direction:column;gap:10px;">
              ${['Márkára szabva az oldaladhoz', 'Esti és hétvégi érdeklődéseket kezeli', 'Minden potenciális pácienst elkap'].map(t => `
                <div style="display:flex;gap:10px;align-items:center;font-size:13px;color:var(--ink-soft);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ${t}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Card 2: Booking -->
        <div class="card" style="padding:36px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:#FEF3C7;border-radius:50%;"></div>

          <div style="position:relative;">
            <div style="width:52px;height:52px;background:var(--ink);border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>

            <h3 style="font-size:26px;font-weight:700;letter-spacing:-0.6px;margin-bottom:12px;">Online foglalás</h3>
            <p style="font-size:14px;color:var(--ink-muted);line-height:1.6;margin-bottom:20px;">
              A pácienseid 3 kattintással foglalnak. Azonnal szinkronizálódik a Google Naptáraddal. SMS emlékeztetők is benne vannak.
            </p>

            <div style="display:flex;flex-direction:column;gap:10px;">
              ${['Google Naptár szinkron', 'SMS időpont emlékeztetők', 'Mobilon is működik'].map(t => `
                <div style="display:flex;gap:10px;align-items:center;font-size:13px;color:var(--ink-soft);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ${t}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom tag row -->
      <div style="display:flex;gap:12px;margin-top:32px;">
        ${['Márkára szabva', '24/7 elérhető', 'Kulcsrakész telepítés', 'Neked nincs fejlesztői munkád'].map(t => `
          <div style="padding:8px 16px;background:var(--card);border:1px solid var(--border);border-radius:100px;font-size:12px;font-weight:500;color:var(--ink-soft);">${t}</div>
        `).join('')}
      </div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 3 — THE CHATBOT
  // ═══════════════════════════════════════════════════════════════════
  const page3 = `
    <div class="page" style="padding:60px 70px;background:var(--bg);">
      <div class="pill" style="margin-bottom:24px;"><span class="pill-dot"></span>A chatbot</div>

      <div style="display:grid;grid-template-columns:1.25fr 1fr;gap:60px;align-items:center;">
        <!-- Left: copy -->
        <div>
          <h2 class="display" style="font-size:66px;margin-bottom:20px;">
            Úgy néz ki mint<br>
            az oldalad. <span class="gradient-text">Egyedileg építve.</span>
          </h2>
          <p style="font-size:16px;color:var(--ink-muted);line-height:1.6;margin-bottom:32px;max-width:520px;">
            Nem egy generikus widget az oldalra dobva. A te színeidet, tipográfiádat, hangnemed használjuk — hogy úgy érződjön, mintha az oldalad része lenne.
          </p>

          <!-- Feature grid 2x3 -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 32px;">
            ${[
              { icon: '🎨', title: 'Márkára szabva', desc: 'Pixel-pontosan a designodhoz' },
              { icon: '🧠', title: 'Rád tanítva', desc: 'Szolgáltatások, nyitvatartás, GYIK' },
              { icon: '⚡', title: '24/7 aktív', desc: 'Még éjjel 2-kor is' },
              { icon: '📩', title: 'Lead elkapás', desc: 'Minden üzenet a recepcióhoz' },
              { icon: '🚨', title: 'Sürgős eset szűrés', desc: 'Jelzi a sürgős eseteket' },
              { icon: '📊', title: 'Analytics', desc: 'Google Analytics követés' },
            ].map(f => `
              <div style="display:flex;gap:12px;">
                <div style="width:36px;height:36px;background:var(--accent-soft);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${f.icon}</div>
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--ink);margin-bottom:2px;letter-spacing:-0.2px;">${f.title}</div>
                  <div style="font-size:12px;color:var(--ink-muted);line-height:1.4;">${f.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right: chatbot mockup -->
        <div style="display:flex;justify-content:center;">
          <div style="width:320px;background:#fff;border-radius:20px;border:1px solid var(--border);overflow:hidden;box-shadow:0 30px 80px rgba(99,102,241,0.12),0 10px 30px rgba(0,0,0,0.08);">
            <!-- header -->
            <div style="background:var(--ink);padding:18px 22px;color:#fff;display:flex;align-items:center;gap:12px;">
              <div style="width:38px;height:38px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div>
                <div style="font-size:14px;font-weight:700;letter-spacing:-0.2px;">Csevegjünk</div>
                <div style="font-size:11px;color:var(--accent-bright);display:flex;align-items:center;gap:5px;margin-top:2px;"><span style="width:6px;height:6px;background:#22c55e;border-radius:50%;display:inline-block;"></span>Online most</div>
              </div>
            </div>
            <!-- body -->
            <div style="padding:22px;background:#FAFAFA;min-height:270px;">
              <div style="background:#fff;border:1px solid var(--border);border-radius:16px 16px 16px 4px;padding:12px 15px;font-size:12px;color:var(--ink);margin-bottom:12px;max-width:240px;line-height:1.5;">
                Üdv! 👋 Miben segíthetek? Tudok időpontot foglalni, válaszolni a kérdéseire, vagy átkapcsolom a recepcióra.
              </div>
              <div style="background:var(--ink);color:#fff;border-radius:16px 16px 4px 16px;padding:12px 15px;font-size:12px;margin-bottom:12px;margin-left:auto;max-width:210px;line-height:1.5;">
                Szeretnék időpontot foglalni a fiamnak ellenőrzésre.
              </div>
              <div style="background:#fff;border:1px solid var(--border);border-radius:16px 16px 16px 4px;padding:12px 15px;font-size:12px;color:var(--ink);max-width:240px;line-height:1.5;">
                Persze! Melyik nap lenne jó — ezen vagy a jövő héten? 📅
              </div>
            </div>
            <!-- input -->
            <div style="padding:14px 18px;background:#fff;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;">
              <div style="flex:1;height:30px;background:#F4F4F5;border-radius:100px;padding:8px 14px;font-size:11px;color:var(--ink-subtle);">Írj egy üzenetet…</div>
              <div style="width:30px;height:30px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="position:absolute;bottom:40px;left:70px;font-size:11px;color:var(--ink-subtle);letter-spacing:0.5px;">Page 03</div>
      <div style="position:absolute;bottom:40px;right:70px;font-size:11px;color:var(--ink-subtle);letter-spacing:0.5px;">smartflowdev</div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 4 — BOOKING
  // ═══════════════════════════════════════════════════════════════════
  const page4 = `
    <div class="page" style="padding:60px 70px;background:var(--bg);">
      <div class="pill" style="margin-bottom:24px;"><span class="pill-dot"></span>Online booking</div>

      <div style="display:grid;grid-template-columns:1fr 1.25fr;gap:60px;align-items:center;">
        <!-- Left: booking mockup -->
        <div style="display:flex;justify-content:center;">
          <div style="width:320px;background:#fff;border-radius:20px;border:1px solid var(--border);overflow:hidden;box-shadow:0 30px 80px rgba(245,158,11,0.12),0 10px 30px rgba(0,0,0,0.08);">
            <div style="padding:26px 24px 20px;">
              <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:8px;">Időpont foglalás</div>
              <h3 style="font-size:22px;font-weight:700;letter-spacing:-0.4px;margin-bottom:20px;">Válassz egy időt</h3>

              <!-- calendar -->
              <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:18px;">
                ${['M','T','W','T','F','S','S'].map(d => `<div style="text-align:center;font-size:10px;color:var(--ink-muted);font-weight:600;padding:4px 0;">${d}</div>`).join('')}
                ${Array.from({length: 14}, (_, i) => {
                  const d = i + 1;
                  const active = d === 10;
                  return `<div style="text-align:center;font-size:12px;font-weight:${active ? '700' : '500'};color:${active ? '#fff' : 'var(--ink)'};background:${active ? 'var(--ink)' : 'transparent'};border-radius:8px;padding:7px 0;">${d}</div>`;
                }).join('')}
              </div>

              <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-muted);font-weight:600;margin-bottom:10px;">Elérhető időpontok</div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:20px;">
                ${['9:00', '10:30', '11:00', '14:00', '15:30', '16:00'].map((t, i) => {
                  const active = i === 2;
                  return `<div style="text-align:center;padding:9px 0;font-size:11px;font-weight:600;color:${active ? '#fff' : 'var(--ink)'};background:${active ? 'var(--accent)' : '#F4F4F5'};border-radius:10px;">${t}</div>`;
                }).join('')}
              </div>

              <div style="background:var(--ink);color:#fff;padding:14px 0;text-align:center;font-size:14px;font-weight:600;border-radius:12px;">
                Foglalás megerősítése →
              </div>
            </div>
          </div>
        </div>

        <!-- Right: copy -->
        <div>
          <h2 class="display" style="font-size:66px;margin-bottom:20px;">
            3 kattintás. <span class="gradient-text">Kész.</span>
          </h2>
          <p style="font-size:16px;color:var(--ink-muted);line-height:1.6;margin-bottom:32px;max-width:520px;">
            A páciensek dátumot, időt, szolgáltatást választanak. Másodpercek alatt landol a Google Naptáradban. Nincs telefonzaklatás, nincs várakozási zene, nincsenek elszalasztott hívások.
          </p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 32px;">
            ${[
              { icon: '📆', title: 'Naptár szinkron', desc: 'Azonnali Google Naptár bejegyzés' },
              { icon: '💬', title: 'SMS emlékeztetők', desc: '24 órával az időpont előtt' },
              { icon: '📱', title: 'Mobilra optimalizálva', desc: 'A páciensek telefonról foglalnak' },
              { icon: '🔄', title: 'Önkiszolgáló', desc: 'Átfoglalás telefonálás nélkül' },
              { icon: '✉️', title: 'Automata visszaigazolás', desc: 'Azonnali email a páciensnek' },
              { icon: '🔗', title: 'A te workflow-d', desc: 'Integrálható a meglévő rendszereiddel' },
            ].map(f => `
              <div style="display:flex;gap:12px;">
                <div style="width:36px;height:36px;background:#FEF3C7;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${f.icon}</div>
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--ink);margin-bottom:2px;letter-spacing:-0.2px;">${f.title}</div>
                  <div style="font-size:12px;color:var(--ink-muted);line-height:1.4;">${f.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div style="position:absolute;bottom:40px;left:70px;font-size:11px;color:var(--ink-subtle);letter-spacing:0.5px;">Page 04</div>
      <div style="position:absolute;bottom:40px;right:70px;font-size:11px;color:var(--ink-subtle);letter-spacing:0.5px;">smartflowdev</div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 5 — WHY NOW
  // ═══════════════════════════════════════════════════════════════════
  const page5 = `
    <div class="page" style="padding:60px 70px;background:var(--ink);color:#fff;">
      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(99,102,241,0.15);color:var(--accent-bright);padding:8px 16px;border-radius:100px;font-size:12px;font-weight:600;margin-bottom:24px;">
        <span style="width:6px;height:6px;background:var(--accent-bright);border-radius:50%;"></span>
        Az adatok
      </div>

      <h2 class="display" style="font-size:80px;margin-bottom:20px;color:#fff;">
        2026-ban a páciensek<br>
        nem <span style="color:var(--accent-bright);">várnak.</span>
      </h2>
      <p style="font-size:17px;color:#A1A1AA;max-width:640px;line-height:1.55;margin-bottom:48px;">
        Így döntenek és foglalnak ma a páciensek fogászati ellátásra. Nem jóslatok — valódi viselkedés tízezernyi páciens útjából.
      </p>

      <!-- 4 stat cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;">
        ${[
          { value: '73', unit: '%', label: 'választ vár 1 órán belül', color: '#818CF8' },
          { value: '68', unit: '%', label: 'inkább online foglalna mint telefonon', color: '#84CC16' },
          { value: '3', unit: '×', label: 'több foglalás chatbot + foglalás mellett', color: '#F59E0B' },
          { value: '7', unit: '×', label: 'magasabb konverzió 1 órán belüli válasszal', color: '#F43F5E' },
        ].map(s => `
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px 28px;">
            <div style="display:flex;align-items:baseline;margin-bottom:16px;">
              <div style="font-size:80px;font-weight:800;letter-spacing:-3px;line-height:0.9;color:${s.color};">${s.value}</div>
              <div style="font-size:36px;font-weight:700;color:${s.color};margin-left:4px;">${s.unit}</div>
            </div>
            <div style="font-size:13px;color:#D4D4D8;line-height:1.5;">${s.label}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);font-size:11px;color:#71717A;letter-spacing:0.3px;">
        Sources: Google Consumer Insights, HubSpot Research 2025, BrightLocal Consumer Survey
      </div>

      <div style="position:absolute;bottom:40px;left:70px;font-size:11px;color:#71717A;letter-spacing:0.5px;">Page 05</div>
      <div style="position:absolute;bottom:40px;right:70px;font-size:11px;color:#71717A;letter-spacing:0.5px;">smartflowdev</div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 6 — ÁRAJÁNLAT (no specific prices)
  // ═══════════════════════════════════════════════════════════════════
  const page6 = `
    <div class="page" style="padding:60px 70px;background:var(--bg);">
      <div class="pill" style="margin-bottom:24px;"><span class="pill-dot"></span>Árajánlat</div>

      <h2 class="display" style="font-size:72px;margin-bottom:20px;">
        Egyedi árazás. <span class="gradient-text">Projekt szerint.</span>
      </h2>
      <p style="font-size:17px;color:var(--ink-muted);max-width:640px;line-height:1.55;margin-bottom:48px;">
        Minden praxis más — más szolgáltatások, más igények, más lépték. Ezért nincs fix árlistánk. Egy rövid beszélgetés után pontos, transzparens ajánlatot küldünk pár órán belül.
      </p>

      <!-- 3 included cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:36px;">
        ${[
          {
            title: 'Mindig benne van',
            items: [
              'Márkára szabott chatbot',
              'A praxisod adataira betanítva',
              'Telepítés és élesítés',
              'Mobilra optimalizálva',
            ],
          },
          {
            title: 'Lehetséges bővítések',
            items: [
              'Online időpontfoglalás',
              'Google Naptár szinkron',
              'SMS emlékeztetők',
              'AI telefonos asszisztens',
            ],
          },
          {
            title: 'Folyamatos támogatás',
            items: [
              'Hosting és frissítések',
              'Email támogatás',
              'Negyedéves fejlesztések',
              'Bármikor lemondható',
            ],
          },
        ].map((col, idx) => {
          const featured = idx === 0;
          const bg = featured ? 'var(--ink)' : 'var(--card)';
          const txt = featured ? '#fff' : 'var(--ink)';
          const muted = featured ? '#A1A1AA' : 'var(--ink-muted)';
          const border = featured ? 'none' : '1px solid var(--border)';
          return `
            <div style="background:${bg};color:${txt};border-radius:24px;padding:32px 28px;${border};${featured ? 'box-shadow:0 30px 80px rgba(99,102,241,0.25);' : ''}">
              <div style="font-size:14px;font-weight:700;color:${featured ? 'var(--accent-bright)' : 'var(--accent)'};margin-bottom:18px;letter-spacing:0.3px;text-transform:uppercase;">${col.title}</div>
              <ul style="list-style:none;padding:0;">
                ${col.items.map(f => `
                  <li style="font-size:14px;color:${featured ? '#E4E4E7' : 'var(--ink-soft)'};padding:9px 0;display:flex;align-items:flex-start;gap:10px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${featured ? 'var(--accent-bright)' : 'var(--accent)'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${f}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          `;
        }).join('')}
      </div>

      <!-- CTA strip -->
      <div style="background:var(--accent-soft);border:1px solid var(--accent);border-radius:20px;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.3px;margin-bottom:4px;">Kérj árajánlatot</div>
          <div style="font-size:13px;color:var(--ink-muted);">Válaszolj az emailre — pár órán belül egyedi ajánlat érkezik vissza.</div>
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--accent);">geri@smartflowdev.com →</div>
      </div>

      <div style="display:flex;justify-content:center;gap:28px;margin-top:24px;">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-muted);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Pénzvisszafizetési garancia
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-muted);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Magyar nyelven
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-muted);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          5 munkanap alatt élesedés
        </div>
      </div>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 7 — GET STARTED
  // ═══════════════════════════════════════════════════════════════════
  const page7 = `
    <div class="page" style="padding:50px 70px;background:var(--bg);display:flex;flex-direction:column;">
      <div class="pill" style="margin-bottom:18px;"><span class="pill-dot"></span>Csináljuk</div>

      <h2 class="display" style="font-size:78px;margin-bottom:16px;">
        Élesben az oldaladon<br>
        <span class="gradient-text">5 munkanap alatt.</span>
      </h2>
      <p style="font-size:16px;color:var(--ink-muted);max-width:640px;line-height:1.5;margin-bottom:32px;">
        Válaszolj az emailre, a többit elintézzük — végponttól végpontig megépítve és telepítve az oldaladra a megrendelés visszaigazolásától számított 5 munkanapon belül.
      </p>

      <!-- 3 steps -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:32px;">
        ${[
          { n: '01', title: 'Válaszolj', desc: 'Válaszolj az emailre. Beszéljük meg a részleteket.' },
          { n: '02', title: 'Megépítjük', desc: 'Végpontig építve a te brandedhez igazítva.' },
          { n: '03', title: 'Élesedés', desc: 'Telepítve és élesben az oldaladon 5 nap alatt.' },
        ].map(s => `
          <div class="card" style="padding:22px;">
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">
              <div style="font-size:36px;font-weight:800;letter-spacing:-1.2px;color:var(--accent);line-height:1;">${s.n}</div>
              <div style="flex:1;height:1px;background:var(--border);"></div>
            </div>
            <div style="font-size:18px;font-weight:700;letter-spacing:-0.3px;margin-bottom:4px;">${s.title}</div>
            <div style="font-size:12px;color:var(--ink-muted);line-height:1.5;">${s.desc}</div>
          </div>
        `).join('')}
      </div>

      <!-- CTA row -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border);margin-top:auto;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div class="btn" style="padding:14px 26px;font-size:14px;">
            Válaszolj az emailre
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <div style="font-size:12px;color:var(--ink-muted);">vagy csak kérdezz bármit — pár órán belül válaszolunk</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:700;letter-spacing:-0.3px;">geri@smartflowdev.com</div>
          <div style="font-size:11px;color:var(--ink-muted);">smartflowdev.com</div>
        </div>
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${css}</style></head>
<body>${page1}${page2}${page3}${page4}${page5}${page6}${page7}</body></html>`;
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

export async function generatePdfV5Hu(outputPath: string = OUT_PATH): Promise<string> {
  const html = buildHtml();

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_W, height: PAGE_H });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await new Promise(r => setTimeout(r, 2000));

    await page.pdf({
      path: outputPath,
      width: `${PAGE_W}px`,
      height: `${PAGE_H}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    console.log(`✅ PDF generated: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  generatePdfV5Hu(OUT_PATH)
    .then(p => {
      console.log(`\n📄 Modern dental proposal PDF ready at:\n   ${p}\n`);
    })
    .catch(err => {
      console.error('❌ PDF generation failed:', err);
      process.exit(1);
    });
}
