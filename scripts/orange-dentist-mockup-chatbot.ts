import { chromium } from 'playwright';
import * as path from 'path';

const OUT = path.resolve(__dirname, '../output/mockups/orange-dentist-clone');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Recreate the Orange Dentist site faithfully + chatbot overlay
  await page.setContent(`
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', -apple-system, sans-serif; overflow: hidden; }

  /* Top bar */
  .topbar {
    background: #2d3e50; color: white; padding: 10px 60px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13px;
  }
  .topbar-left { display: flex; align-items: center; gap: 24px; }
  .topbar-left a { color: white; text-decoration: none; display: flex; align-items: center; gap: 6px; }
  .topbar-left svg { width: 16px; height: 16px; fill: #E9681D; }
  .topbar-right { display: flex; gap: 12px; }
  .topbar-right a { color: white; font-size: 18px; text-decoration: none; }

  /* Nav */
  .navbar {
    padding: 16px 60px; display: flex; align-items: center; justify-content: space-between;
    background: white; border-bottom: 1px solid #f0f0f0;
  }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-icon { width: 56px; height: 56px; }
  .logo-text { font-size: 24px; font-weight: 700; color: #2d3e50; }
  .logo-sub { font-size: 13px; color: #E9681D; font-weight: 500; }
  .nav-links { display: flex; gap: 32px; }
  .nav-links a { text-decoration: none; font-size: 14px; font-weight: 600; color: #2d3e50; letter-spacing: 0.5px; }
  .nav-links a.active { color: #E9681D; }

  /* Hero */
  .hero {
    position: relative; height: 520px;
    background: linear-gradient(135deg, #e8eef5 0%, #d5dfe8 100%);
    overflow: hidden;
  }
  .hero-bg {
    position: absolute; inset: 0;
    background: url('https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1400&h=520&fit=crop') center/cover;
    filter: brightness(0.95);
  }

  /* Opening Hours card */
  .hours-card {
    position: absolute; right: 80px; bottom: -40px; width: 340px; z-index: 10;
  }
  .hours-header {
    background: #E9681D; color: white; padding: 20px 28px;
    font-size: 28px; font-weight: 700; border-radius: 0;
  }
  .hours-body {
    background: white; padding: 20px 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }
  .hours-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; color: #2d3e50;
  }
  .hours-row .day { display: flex; align-items: center; gap: 8px; font-weight: 500; }
  .hours-row .time { font-weight: 600; }
  .hours-btn {
    display: block; width: 100%; margin-top: 16px; padding: 12px;
    background: white; border: 2px solid #2d3e50; color: #2d3e50;
    font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-align: center;
    cursor: pointer; font-family: inherit;
  }

  /* Existing chat bubble (their site has one) */
  .existing-bubble {
    position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;
    background: #E9681D; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(233,104,29,0.4); z-index: 50;
  }
  .existing-bubble svg { width: 28px; height: 28px; fill: white; }

  /* ═══ OUR CHATBOT WIDGET ═══ */
  .chatbot-widget {
    position: fixed; bottom: 24px; right: 24px; z-index: 99999;
    width: 380px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    filter: drop-shadow(0 8px 32px rgba(0,0,0,0.18));
  }
  .chat-window { background: white; border-radius: 16px; overflow: hidden; }
  .chat-header {
    background: #E9681D; padding: 16px 20px; display: flex; align-items: center; gap: 12px;
  }
  .chat-avatar {
    width: 42px; height: 42px; background: white; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 22px;
  }
  .chat-title { color: white; font-weight: 700; font-size: 16px; }
  .chat-status { color: rgba(255,255,255,0.8); font-size: 12px; }
  .chat-messages {
    padding: 20px; display: flex; flex-direction: column; gap: 12px;
    background: #fafafa; min-height: 300px;
  }
  .msg-row { display: flex; gap: 8px; align-items: flex-start; }
  .msg-row.user { justify-content: flex-end; }
  .msg-ai-avatar {
    width: 28px; height: 28px; background: #E9681D; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 11px; font-weight: 700; flex-shrink: 0;
  }
  .msg-bubble {
    padding: 12px 16px; font-size: 14px; line-height: 1.5; max-width: 260px;
  }
  .msg-bubble.bot {
    background: white; color: #333; border-radius: 4px 16px 16px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .msg-bubble.user-msg {
    background: #E9681D; color: white; border-radius: 16px 4px 16px 16px;
  }
  .chat-input {
    padding: 12px 16px; border-top: 1px solid #eee; display: flex; gap: 8px;
    align-items: center; background: white;
  }
  .chat-input input {
    flex: 1; border: 1px solid #e0e0e0; border-radius: 20px;
    padding: 10px 16px; font-size: 14px; outline: none; font-family: inherit;
  }
  .chat-send {
    width: 38px; height: 38px; background: #E9681D; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
  }
  .chat-footer { text-align: center; padding: 6px; font-size: 10px; color: #bbb; }
</style>
</head>
<body>

<!-- Top Bar -->
<div class="topbar">
  <div class="topbar-left">
    <a>
      <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
      02 6362 1323 + 02 6369 0906
    </a>
    <a>
      <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
      reception@orangedentist.com.au
    </a>
    <a>
      <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      296 Anson St., ORANGE NSW 2800
    </a>
  </div>
  <div class="topbar-right">
    <a>☐</a>
    <a>◎</a>
  </div>
</div>

<!-- Navigation -->
<div class="navbar">
  <div class="logo">
    <svg class="logo-icon" viewBox="0 0 60 60">
      <!-- Simplified tooth+orange logo -->
      <circle cx="30" cy="22" r="10" fill="#E9681D"/>
      <ellipse cx="30" cy="15" rx="4" ry="6" fill="#4CAF50"/>
      <path d="M20 30 Q20 50 26 55 Q30 48 30 40 Q30 48 34 55 Q40 50 40 30 Z" fill="white" stroke="#E9681D" stroke-width="2"/>
    </svg>
    <div>
      <div class="logo-text">Your Orange Dentist</div>
      <div class="logo-sub">Family Dental Practice</div>
    </div>
  </div>
  <div class="nav-links">
    <a class="active">HOME</a>
    <a>ABOUT US</a>
    <a>DENTAL SERVICES</a>
    <a>CONTACT US</a>
  </div>
</div>

<!-- Hero Image -->
<div class="hero">
  <div class="hero-bg"></div>
  <!-- Opening Hours -->
  <div class="hours-card">
    <div class="hours-header">Opening Hours</div>
    <div class="hours-body">
      <div class="hours-row"><span class="day">⏰ Monday</span><span class="time">08:30AM - 05:00PM</span></div>
      <div class="hours-row"><span class="day">⏰ Tuesday</span><span class="time">08:30AM - 05:00PM</span></div>
      <div class="hours-row"><span class="day">⏰ Wednesday</span><span class="time">08:30AM - 05:00PM</span></div>
      <div class="hours-row"><span class="day">⏰ Thursday</span><span class="time">08:30AM - 06:30PM</span></div>
      <div class="hours-row"><span class="day">⏰ Friday</span><span class="time">08:30AM - 05:00PM</span></div>
      <div class="hours-row" style="border:none"><span class="day">⏰ Every 2nd Saturday</span><span class="time">8:30AM-2:00PM</span></div>
      <button class="hours-btn">MAKE AN APPOINTMENT</button>
    </div>
  </div>
</div>

<!-- Chatbot Widget -->
<div class="chatbot-widget">
  <div class="chat-window">
    <div class="chat-header">
      <div class="chat-avatar">🦷</div>
      <div>
        <div class="chat-title">Orange Dentist AI</div>
        <div class="chat-status">● Online now</div>
      </div>
    </div>
    <div class="chat-messages">
      <div class="msg-row">
        <div class="msg-ai-avatar">AI</div>
        <div class="msg-bubble bot">Hi! 👋 I'm the Orange Dentist AI assistant. How can I help you today?</div>
      </div>
      <div class="msg-row user">
        <div class="msg-bubble user-msg">I'd like to book a teeth cleaning</div>
      </div>
      <div class="msg-row">
        <div class="msg-ai-avatar">AI</div>
        <div class="msg-bubble bot">Sure! Our next available slot for a cleaning is <strong>Thursday at 2:00 PM</strong>. Would you like me to book that for you? 📋</div>
      </div>
      <div class="msg-row user">
        <div class="msg-bubble user-msg">Yes please!</div>
      </div>
      <div class="msg-row">
        <div class="msg-ai-avatar">AI</div>
        <div class="msg-bubble bot">Done! ✅ Your cleaning appointment is booked for <strong>Thu, April 10 at 2:00 PM</strong>. You'll get an SMS reminder 24h before.</div>
      </div>
    </div>
    <div class="chat-input">
      <input placeholder="Type your message..." />
      <div class="chat-send"><span style="color:white;font-size:16px">➤</span></div>
    </div>
    <div class="chat-footer">Powered by smartflowdev</div>
  </div>
</div>

</body>
</html>
  `, { waitUntil: 'domcontentloaded' });

  // Wait for the hero image to load
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(OUT, 'mockup-with-chatbot.png') });
  console.log('✅ mockup-with-chatbot.png');

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
