// The Review Room skin — the single stylesheet that turns the Weered chrome into
// the ECEB advisory office. Injected by RootFrame as the LAST node in <body>
// (see the ensureStyle/MutationObserver machinery there) so it wins the cascade
// over component <style> blocks and the press theme.
//
// Every rule is scoped under html[data-office-skin]; off the gate this file has
// zero effect. Mechanics preserved from the battle-tested original:
//   - inline purple matched in the BROWSER-NORMALIZED "rgb(124, 58, 237)" comma-space
//     form (hex in a style attr serializes to that; no-space forms match nothing)
//   - SVG data-URI section banners recolored via filter on the ::before/::after of
//     [class*="-section"] / [class*="-head"] / [class*="weered-uc"] / .weered-presence
//   - .weered-usercorner + .weered-presence-head whole-wrapper filters
//   - .weered-rail-logo img content-swap to the ECEB anchor
//   - Tailwind violet/purple/indigo class neutralizers
// Colors are re-tuned from the old brass/gunmetal to the ink-navy token set.

export const OFFICE_SKIN_CSS = `
/* ============ TOKENS ============ */
html[data-office-skin]{
  /* Fathom design tokens — shared with office-only components */
  --fathom-ink:#0A1D35;--fathom-panel:#122A4A;--fathom-hairline:#1E3A5F;
  --fathom-gold:#C6A15B;--fathom-gold-bright:#D9B878;
  --fathom-gold-grad:linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F);
  --fathom-paper:#F7F4EC;--fathom-paper-ink:#10233F;
  --fathom-text:rgba(236,242,250,.95);--fathom-muted:rgba(163,180,202,.72);
  --fathom-hot:#B54A44;--fathom-warn:#C99B3F;--fathom-good:#3E7D5C;
  --fathom-ease:cubic-bezier(0.22,0.61,0.36,1);
  --fathom-serif:Georgia,'Iowan Old Style',Cambria,'Times New Roman',serif;
  --fathom-ui:'Segoe UI',Inter,system-ui,-apple-system,sans-serif;
  /* Weered var remap — everything downstream of the vars inherits the room */
  --weered-bg:#0A1D35!important;--weered-panel:#122A4A!important;--weered-panel2:#0E2340!important;
  --weered-border:#1E3A5F!important;--weered-border2:#2C4E7C!important;
  --weered-text:rgba(236,242,250,.95)!important;--weered-muted:rgba(163,180,202,.72)!important;
  --weered-accent-1:#C6A15B!important;--weered-accent-2:#A8853F!important;
  --weered-accent-bg:rgba(198,161,91,.12)!important;--weered-accent-ring:rgba(198,161,91,.32)!important;
  --weered-accent-grad:linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F)!important;
  --weered-accent-text:rgba(217,184,120,.95)!important;
  --weered-scrollbar-track:rgba(255,255,255,.04)!important;
  --weered-scrollbar-thumb:rgba(163,180,202,.24)!important;
  --weered-scrollbar-thumb-hover:rgba(163,180,202,.40)!important;
  /* chrome-min re-declares these with !important at equal specificity; this sheet
     is injected last so these win. --weered-user-panel-accent/-bg color the
     chamfered section banners (the "chevron hats") + backplates directly — the
     geometry (clip-path taper, insets) is chrome-min's and stays untouched. */
  --weered-accent:#C6A15B!important;
  --weered-user-panel-accent:#16345C!important;
  --weered-user-panel-bg:#0F2440!important;
}

/* ============ GROUND + TYPE ============ */
html[data-office-skin] body{
  background:#0A1D35!important;color:rgba(236,242,250,.95)!important;
  font-family:'Segoe UI',Inter,system-ui,-apple-system,sans-serif!important;
  font-variant-numeric:tabular-nums lining-nums;
}
html[data-office-skin] button,html[data-office-skin] input,
html[data-office-skin] textarea,html[data-office-skin] select{
  font-family:'Segoe UI',Inter,system-ui,-apple-system,sans-serif!important;
}
/* Figures: serif display numerals, always tabular */
html[data-office-skin] .fathom-fig,html[data-office-skin] [data-fathom-fig]{
  font-family:Georgia,'Iowan Old Style',Cambria,'Times New Roman',serif!important;
  font-variant-numeric:tabular-nums lining-nums!important;
}
html[data-office-skin] a{color:rgba(236,242,250,.92);}
html[data-office-skin] a:hover{color:#D9B878;}
html[data-office-skin] ::selection{background:rgba(198,161,91,.28);color:rgba(236,242,250,.98);}
html[data-office-skin] h1,html[data-office-skin] h2,html[data-office-skin] h3,
html[data-office-skin] h4,html[data-office-skin] strong,html[data-office-skin] legend,
html[data-office-skin] label{color:rgba(236,242,250,.95);}

/* ============ MILLED PANELS ============ */
/* Press paints these with an explicit dark gradient (not the var), so override the
   surfaces directly: lifted navy, top inner-highlight hairline, weighted shadow. */
html[data-office-skin] .weered-panel,html[data-office-skin] .weered-panel2,
html[data-office-skin] .weered-left,html[data-office-skin] .weered-right,
html[data-office-skin] .weered-icon-strip,
html[data-office-skin] .weered-overlay-panel{
  background:linear-gradient(180deg,#152F52 0%,#122A4A 100%)!important;
  border:0!important;border-radius:8px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px #1E3A5F,0 8px 24px rgba(0,0,0,.35)!important;
}
html[data-office-skin] .weered-usercorner{
  background:linear-gradient(180deg,#152F52 0%,#122A4A 100%)!important;border:0!important;border-radius:8px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px #1E3A5F,0 8px 24px rgba(0,0,0,.35)!important;
}
html[data-office-skin] .weered-usercorner:hover{background:linear-gradient(180deg,#173357 0%,#142C4E 100%)!important;border-color:transparent!important;}
/* Chevron sections (.weered-left-section / .weered-presence): chrome-min draws them
   as a tapered banner "hat" (::before, inset right:8px) over a backplate (::after,
   inset right:24px) — DELIBERATELY narrower than the section box. Never ring or
   radius the section itself: any outline traces the invisible full-width box and
   floats past the visible plates (the "borders all around" bug). Color comes from
   the --weered-user-panel-* vars in the token block; geometry stays chrome-min's. */
html[data-office-skin] .weered-left-section,html[data-office-skin] .weered-presence{
  background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;
}
html[data-office-skin] .weered-rr-create-panel,html[data-office-skin] .weered-rr-mod-panel,
html[data-office-skin] .weered-lobby-tabs,html[data-office-skin] .weered-dock-tabs{
  background:#0C2140!important;border:0!important;border-radius:6px!important;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 0 0 1px #1E3A5F!important;
}
html[data-office-skin] .weered-dock{
  background:linear-gradient(180deg,#152F52 0%,#122A4A 100%)!important;border:0!important;border-radius:8px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px #1E3A5F,0 8px 24px rgba(0,0,0,.35)!important;
}
html[data-office-skin] .weered-lobby-grid > *{
  background:linear-gradient(180deg,#152F52 0%,#122A4A 100%)!important;border:0!important;border-radius:8px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px #1E3A5F,0 8px 24px rgba(0,0,0,.35)!important;
  transform:none!important;
}
html[data-office-skin] .weered-lobby-grid > *:hover{
  transform:none!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px #2C4E7C,0 8px 24px rgba(0,0,0,.35)!important;
}
html[data-office-skin] .weered-hero-content::before{background:#1E3A5F!important;box-shadow:none!important;}

/* ============ KICKERS (section labels) ============ */
html[data-office-skin] .weered-left-title,html[data-office-skin] .weered-presence-title,
html[data-office-skin] .weered-rr-section-title,html[data-office-skin] .weered-rr-create-title,
html[data-office-skin] .weered-dock-title{
  background:transparent!important;color:rgba(163,180,202,.72)!important;
  font-family:'Segoe UI',Inter,system-ui,-apple-system,sans-serif!important;
  font-size:11px!important;font-weight:600!important;letter-spacing:.12em!important;
  text-transform:uppercase!important;text-shadow:none!important;box-shadow:none!important;
  border-color:#1E3A5F!important;
}
/* Kill the press theme's editorial slash; keep a quiet hairline rule after */
html[data-office-skin] .weered-left-title::before,html[data-office-skin] .weered-presence-title::before,
html[data-office-skin] .weered-rr-section-title::before{content:none!important;}
html[data-office-skin] .weered-left-title::after,html[data-office-skin] .weered-presence-title::after,
html[data-office-skin] .weered-rr-section-title::after{
  background:linear-gradient(90deg,#1E3A5F 0%,rgba(30,58,95,0) 100%)!important;height:1px!important;
}
html[data-office-skin] .weered-left-title,html[data-office-skin] .weered-presence-head{border-bottom-color:#1E3A5F!important;}

/* ============ LEFT RAIL — hairlines, not boxes ============ */
html[data-office-skin] .weered-left-link{
  background:transparent!important;border:0!important;border-radius:6px!important;
  color:rgba(236,242,250,.85)!important;font-weight:600!important;letter-spacing:.01em!important;
  box-shadow:none!important;transform:none!important;
  transition:background-color 260ms cubic-bezier(0.22,0.61,0.36,1),color 260ms cubic-bezier(0.22,0.61,0.36,1)!important;
}
html[data-office-skin] .weered-left-link:hover{
  background:rgba(255,255,255,.04)!important;color:rgba(236,242,250,.98)!important;
  transform:none!important;box-shadow:none!important;
}
/* Active nav/tab/card: flat lift + one satin-gold hairline (the surface's accent) */
html[data-office-skin] .weered-left-link-active,html[data-office-skin] .weered-dock-tab-active,
html[data-office-skin] .weered-rr-module-btn-active,html[data-office-skin] .weered-rr-room-card-active,
html[data-office-skin] .weered-lobby-tab-active{
  background:rgba(255,255,255,.05)!important;color:rgba(236,242,250,.95)!important;
  transform:none!important;animation:none!important;
  box-shadow:inset 0 -2px 0 #C6A15B!important;
}
/* Press paints an amber topper strip on actives — remove it */
html[data-office-skin] .weered-left-link-active::before,html[data-office-skin] .weered-dock-tab-active::before,
html[data-office-skin] .weered-rr-module-btn-active::before,html[data-office-skin] .weered-rr-room-card-active::before,
html[data-office-skin] .weered-lobby-tab-active::before{display:none!important;content:none!important;}
/* chrome-min's ".weered-left .weered-left-link-active" purple outranks the generic
   actives rule above — match its specificity (this sheet is later, so it wins).
   Nav actives read from a gold LEFT edge (an underline looks odd on full-width rows). */
html[data-office-skin] .weered-left .weered-left-link-active{
  background:rgba(255,255,255,.05)!important;border-color:transparent!important;
  color:rgba(236,242,250,.95)!important;
  box-shadow:inset 2px 0 0 #C6A15B!important;
}
html[data-office-skin] .weered-rr-room-card-active{box-shadow:inset 2px 0 0 #C6A15B,0 0 0 1px #1E3A5F!important;}

/* ============ BUTTONS + INPUTS ============ */
html[data-office-skin] .weered-btn,html[data-office-skin] .weered-btnX,
html[data-office-skin] .weered-uc-action,html[data-office-skin] .weered-rr-primary,
html[data-office-skin] .weered-rr-join,html[data-office-skin] .weered-rr-mod-panel button,
html[data-office-skin] .weered-dock-close,html[data-office-skin] .weered-dock-compose,
html[data-office-skin] .weered-dock-send{
  background:linear-gradient(180deg,#173254 0%,#122A4A 100%)!important;border:0!important;border-radius:6px!important;
  color:rgba(236,242,250,.9)!important;font-family:'Segoe UI',Inter,system-ui,-apple-system,sans-serif!important;
  font-weight:600!important;letter-spacing:.02em!important;text-transform:none!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px #1E3A5F!important;transform:none!important;
  transition:box-shadow 260ms cubic-bezier(0.22,0.61,0.36,1),color 260ms cubic-bezier(0.22,0.61,0.36,1)!important;
}
html[data-office-skin] .weered-btn:hover,html[data-office-skin] .weered-uc-action:hover,
html[data-office-skin] .weered-rr-primary:hover,html[data-office-skin] .weered-rr-join:hover,
html[data-office-skin] .weered-dock-compose:hover,html[data-office-skin] .weered-dock-send:hover{
  background:linear-gradient(180deg,#1B3A61 0%,#152F52 100%)!important;color:rgba(236,242,250,.98)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 0 1px #2C4E7C!important;transform:none!important;
}
html[data-office-skin] .weered-rr-primary-solid{
  background:linear-gradient(180deg,#173254 0%,#122A4A 100%)!important;color:rgba(236,242,250,.95)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px rgba(198,161,91,.55)!important;
}
html[data-office-skin] input,html[data-office-skin] textarea,html[data-office-skin] select,
html[data-office-skin] .weered-input,html[data-office-skin] .weered-presence-search{
  background:#0C2140!important;border:1px solid #1E3A5F!important;border-radius:6px!important;
  color:rgba(236,242,250,.95)!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.35)!important;
}
html[data-office-skin] input:focus,html[data-office-skin] textarea:focus,html[data-office-skin] select:focus{
  border-color:rgba(198,161,91,.55)!important;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 0 0 3px rgba(198,161,91,.18)!important;
}
html[data-office-skin] input::placeholder,html[data-office-skin] textarea::placeholder{color:rgba(163,180,202,.5)!important;}
html[data-office-skin] .weered-rr-id-chip{
  background:#0C2140!important;border:0!important;color:rgba(163,180,202,.72)!important;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.35),0 0 0 1px #1E3A5F!important;
}
html[data-office-skin] .weered-rr-status-chip{
  background:#0C2140!important;border:0!important;color:rgba(217,184,120,.9)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 0 1px #1E3A5F!important;
}

/* ============ ROWS, CARDS, CHIPS ============ */
html[data-office-skin] .weered-rr-room-card,html[data-office-skin] .weered-rr-friend-row,
html[data-office-skin] .weered-rr-crew-row,html[data-office-skin] .weered-dock-thread{
  background:linear-gradient(180deg,#152F52 0%,#122A4A 100%)!important;border:0!important;border-radius:6px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 0 1px #1E3A5F!important;transform:none!important;
}
html[data-office-skin] .weered-rr-room-card:hover,html[data-office-skin] .weered-rr-friend-row:hover,
html[data-office-skin] .weered-rr-crew-row:hover,html[data-office-skin] .weered-dock-thread:hover{
  background:linear-gradient(180deg,#173357 0%,#142C4E 100%)!important;transform:none!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px #2C4E7C!important;
}
html[data-office-skin] .weered-row:hover{background:rgba(255,255,255,.04)!important;border-color:#2C4E7C!important;}
html[data-office-skin] .weered-row-active{background:rgba(255,255,255,.06)!important;border-color:#2C4E7C!important;}
html[data-office-skin] a[href^="/room/"]:hover{border-color:#2C4E7C!important;background:rgba(255,255,255,.03)!important;}
html[data-office-skin] .weered-chip-purple,html[data-office-skin] .weered-badge-god{
  background:rgba(255,255,255,.05)!important;border-color:#1E3A5F!important;color:rgba(236,242,250,.9)!important;
}
html[data-office-skin] .weered-avatar{box-shadow:0 0 0 1px rgba(255,255,255,.12)!important;}
html[data-office-skin] .weered-mark{box-shadow:none!important;}
html[data-office-skin] .weered-mark-paid,html[data-office-skin] .weered-mark-owner,
html[data-office-skin] .weered-mark-god{background:rgba(163,180,202,.6)!important;border-color:rgba(163,180,202,.4)!important;}
html[data-office-skin] .weered-name-paid,html[data-office-skin] .weered-name-owner{color:rgba(236,242,250,.92)!important;}
html[data-office-skin] .weered-dock-bubble{background:#142C4E!important;border:0!important;box-shadow:0 0 0 1px #1E3A5F!important;}
html[data-office-skin] .weered-dock-bubble div{color:rgba(236,242,250,.92)!important;}
html[data-office-skin] .weered-dock-bubble-me{background:#1B3E6B!important;box-shadow:0 0 0 1px #2C4E7C!important;}
html[data-office-skin] .weered-dock-bubble-me div{color:rgba(236,242,250,.95)!important;}
html[data-office-skin] .weered-dock-conv-header{background:transparent!important;border-bottom:1px solid #1E3A5F!important;}
html[data-office-skin] .weered-lobby-tab,html[data-office-skin] .weered-dock-tab{
  background:transparent!important;color:rgba(163,180,202,.72)!important;
  font-family:'Segoe UI',Inter,system-ui,-apple-system,sans-serif!important;
  font-weight:600!important;letter-spacing:.04em!important;
}
html[data-office-skin] .weered-lobby-tab:hover,html[data-office-skin] .weered-dock-tab:hover{color:rgba(236,242,250,.92)!important;}
html[data-office-skin] .weered-rr-module-btn{
  background:transparent!important;border:0!important;color:rgba(163,180,202,.72)!important;
  box-shadow:0 0 0 1px #1E3A5F!important;
}
html[data-office-skin] .weered-rr-module-btn:hover{color:rgba(236,242,250,.92)!important;box-shadow:0 0 0 1px #2C4E7C!important;}

/* ============ MODULE PILLS -> FLAT SEGMENTED CONTROL ============ */
/* The room-header pill row is inline-styled buttons inside a scroller that carries
   the distinctive inline "scrollbar-width: none". Active pills are the only ones
   whose serialized box-shadow contains "inset" (the accent glow) — that is the
   active hook. The glow dot inside the active pill is hidden; the state reads
   from the satin-gold underline alone. */
html[data-office-skin] div[style*="scrollbar-width: none"] > button{
  background:transparent!important;border:0!important;border-radius:0!important;
  color:rgba(163,180,202,.72)!important;box-shadow:none!important;
  padding:6px 12px 8px!important;font-weight:600!important;letter-spacing:.03em!important;
  transition:color 320ms cubic-bezier(0.22,0.61,0.36,1),box-shadow 320ms cubic-bezier(0.22,0.61,0.36,1)!important;
}
html[data-office-skin] div[style*="scrollbar-width: none"] > button:hover{
  background:transparent!important;color:rgba(236,242,250,.88)!important;
}
html[data-office-skin] div[style*="scrollbar-width: none"] > button:disabled{color:rgba(163,180,202,.35)!important;}
html[data-office-skin] div[style*="scrollbar-width: none"] > button[style*="inset"]{
  color:rgba(236,242,250,.95)!important;box-shadow:inset 0 -2px 0 #C6A15B!important;
}
html[data-office-skin] div[style*="scrollbar-width: none"] > button span[style*="border-radius: 50%"]{display:none!important;}

/* ============ ICON STRIP + RAIL FURNITURE ============ */
html[data-office-skin] .weered-icon-strip-btn{
  background:transparent!important;color:rgba(163,180,202,.6)!important;
  border-radius:6px!important;box-shadow:none!important;transform:none!important;
}
html[data-office-skin] .weered-icon-strip-btn:hover{
  background:rgba(255,255,255,.05)!important;color:rgba(236,242,250,.9)!important;
  transform:none!important;box-shadow:none!important;
}
html[data-office-skin] .weered-icon-strip-btn-active{
  background:rgba(198,161,91,.14)!important;color:#D9B878!important;box-shadow:none!important;
}
html[data-office-skin] .weered-rail-close,html[data-office-skin] .weered-rail-close:hover{
  border-color:#2C4E7C!important;background:linear-gradient(180deg,#1B3A61,#152F52)!important;
  color:rgba(236,242,250,.9)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important;
}
html[data-office-skin] .weered-rail-tab{border-color:#1E3A5F!important;}
html[data-office-skin] .weered-rail-tab:hover{border-color:#2C4E7C!important;box-shadow:none!important;background:rgba(255,255,255,.03)!important;}
html[data-office-skin] .weered-rail-tab:hover .weered-rail-tab-label,
html[data-office-skin] .weered-overlay-close:hover{color:#D9B878!important;}
html[data-office-skin] .weered-rail-tab-glow{animation:none!important;box-shadow:none!important;border-color:#1E3A5F!important;}
/* chrome-min paints purple left-edge bars (inset box-shadows + a ::before strip) on
   the collapsed rail stack + quick tab — hairline navy at rest, gold on hover/active */
html[data-office-skin] .weered-rail-quick::before{background:#C6A15B!important;}
html[data-office-skin] .weered-rail-quick,html[data-office-skin] .weered-rail-quick:hover{
  animation:none!important;
  box-shadow:inset 2px 0 0 #C6A15B,inset 0 1px 0 rgba(255,255,255,.05)!important;
}
html[data-office-skin] .weered-rail-stack .weered-rail-tab{box-shadow:inset 3px 0 0 #1E3A5F!important;}
html[data-office-skin] .weered-rail-stack .weered-rail-tab:hover{box-shadow:inset 3px 0 0 #C6A15B!important;}
/* chrome-min re-purples the dock's accent vars at .weered-dock/.weered-dock-tabs level */
html[data-office-skin] .weered-dock,html[data-office-skin] .weered-dock-tabs{
  --weered-accent:#C6A15B!important;
  --weered-accent-bg:rgba(198,161,91,.14)!important;--weered-accent-ring:rgba(198,161,91,.40)!important;
}
html[data-office-skin] .weered-modules-chip{background:rgba(255,255,255,.05)!important;color:rgba(163,180,202,.8)!important;}
html[data-office-skin] .weered-overlay-close:hover{background:rgba(198,161,91,.12)!important;border-color:rgba(198,161,91,.3)!important;}
html[data-office-skin] .weered-mobile-nav-btn{color:rgba(163,180,202,.6)!important;}
html[data-office-skin] .weered-mobile-nav-btn-active{background:rgba(255,255,255,.06)!important;color:rgba(236,242,250,.95)!important;}
html[data-office-skin] .weered-chat-fullscreen-cta{animation:none!important;}
html[data-office-skin] .weered-chat-fullscreen-cta:hover{
  background:linear-gradient(180deg,#1B3A61,#152F52)!important;border-color:#2C4E7C!important;transform:none!important;
}
html[data-office-skin] .weered-chat-fullscreen .weered-chat-members{border-left-color:#1E3A5F!important;background:rgba(10,29,53,.5)!important;}

/* ============ ANCHOR MARK — quiet emboss, no glow ============ */
html[data-office-skin] .weered-rail-logo img,
html[data-office-skin] .weered-rail-logo:hover img{
  content:url("/brand/eceb-anchor-chrome.svg");object-fit:contain;
  filter:drop-shadow(0 -1px 0 rgba(255,255,255,.2)) drop-shadow(0 1px 1px rgba(0,0,0,.55))!important;
}
html[data-office-skin] .weered-rail-logo:hover{transform:none!important;}

/* ============ BANNER RECOLOR — vars, not filters ============ */
/* In rooms (chrome-min) the chamfered banners are FLAT fills of
   --weered-user-panel-accent / -bg, remapped to navy in the token block; the old
   grayscale/sepia/hue-rotate filters double-processed those flats into blue-shifted
   mud and are gone. Kept only for the UserCorner tier art (an actual SVG/image the
   vars cannot reach) — and UserCorner only renders outside office rooms anyway. */
html[data-office-skin] [class*="weered-uc"]::before,html[data-office-skin] [class*="weered-uc"]::after{
  filter:grayscale(1) sepia(1) hue-rotate(178deg) saturate(1.2) brightness(.92)!important;
}
/* The uc banner ground itself (tier art / custom banner) -> plain lifted navy */
html[data-office-skin] .weered-uc-banner{background:linear-gradient(180deg,#16335B 0%,#122A4A 100%)!important;}

/* ============ INLINE PURPLE (browser-normalized comma-space form) ============ */
html[data-office-skin] [style*="124, 58, 237"],
html[data-office-skin] [style*="88, 0, 229"],
html[data-office-skin] [style*="167, 139, 250"],
html[data-office-skin] [style*="139, 92, 246"],
html[data-office-skin] [style*="216, 180, 254"],
html[data-office-skin] [style*="196, 181, 253"],
html[data-office-skin] [style*="109, 40, 217"],
html[data-office-skin] [style*="91, 33, 182"],
html[data-office-skin] [style*="76, 29, 149"]{
  /* NAVY wash, not gold: gold-tinted washes on large surfaces (the voice banner,
     the bottom module bar) read as olive/brown against the ink ground. Gold stays
     reserved for the few deliberate accents declared explicitly. */
  background-image:none!important;background-color:rgba(30,58,95,.42)!important;
  border-color:#2C4E7C!important;box-shadow:none!important;
}
/* Solid purple buttons (Join voice #7c3aed -> rgb(124, 58, 237)): lifted navy key
   with a single gold hairline — gold is never a fill in this room */
html[data-office-skin] button[style*="124, 58, 237"]{
  background:linear-gradient(180deg,#173357 0%,#122A4A 100%)!important;color:rgba(236,242,250,.95)!important;
  border-color:transparent!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px rgba(198,161,91,.5)!important;
}

/* ============ TAILWIND VIOLET/PURPLE/INDIGO NEUTRALIZERS ============ */
html[data-office-skin] [class*="bg-violet"],html[data-office-skin] [class*="bg-purple"],html[data-office-skin] [class*="bg-indigo"],html[data-office-skin] [class*="bg-fuchsia"]{background-color:rgba(198,208,220,.08)!important;background-image:none!important;}
/* the live-presence dot stays a visible solid indicator (neutral steel, not a gold slab) */
html[data-office-skin] [class*="bg-violet-400"]{background-color:rgba(163,180,202,.7)!important;}
/* brand accents on active Broadcast/Walkthrough pills (Twitch purple, YouTube red serialize inline) */
html[data-office-skin] [style*="145, 70, 255"]{background-color:rgba(30,58,95,.42)!important;border-color:#1E3A5F!important;box-shadow:none!important;color:rgba(236,242,250,.95)!important;}
html[data-office-skin] [class*="text-violet"],html[data-office-skin] [class*="text-purple"],html[data-office-skin] [class*="text-indigo"]{color:rgba(217,184,120,.95)!important;}
html[data-office-skin] [class*="border-violet"],html[data-office-skin] [class*="border-purple"],html[data-office-skin] [class*="border-indigo"]{border-color:#2C4E7C!important;}
html[data-office-skin] [class*="from-violet"],html[data-office-skin] [class*="via-violet"],html[data-office-skin] [class*="to-violet"],
html[data-office-skin] [class*="from-purple"],html[data-office-skin] [class*="via-purple"],html[data-office-skin] [class*="to-purple"],
html[data-office-skin] [class*="from-indigo"],html[data-office-skin] [class*="via-indigo"],html[data-office-skin] [class*="to-indigo"]{
  --tw-gradient-from:rgba(44,78,124,.35)!important;--tw-gradient-to:rgba(44,78,124,.05)!important;
  --tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important;
}
/* shadow-[...purple...] glow utilities */
html[data-office-skin] [class*="shadow-"][class*="violet"],
html[data-office-skin] [class*="shadow-"][class*="124,58,237"]{box-shadow:none!important;}

/* ============ EVENT-ROOM SIGNATURE OFF (zero gaming residue) ============ */
html[data-office-skin] .weered-rr-room-card-event,html[data-office-skin] .weered-room-card-event{
  background:linear-gradient(180deg,#152F52 0%,#122A4A 100%)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 0 1px #1E3A5F!important;
}
html[data-office-skin] .weered-rr-room-card-event::before,html[data-office-skin] .weered-rr-room-card-event::after,
html[data-office-skin] .weered-room-card-event::before,html[data-office-skin] .weered-room-card-event::after{display:none!important;}
html[data-office-skin] .weered-event-badge{animation:none!important;}

/* ============ HIDE GAMING TELLS ============ */
html[data-office-skin] .weered-uc-noto,
html[data-office-skin] .weered-uc-banner-tier,
html[data-office-skin] .weered-uc-notoriety{display:none!important;}
/* Paper balance nav entry (the /store left-rail link carries the wallet chip) */
html[data-office-skin] .weered-left-link[href="/store"]{display:none!important;}
/* "WEERED est. 2025" footer — the only margin-top:auto block in the left rail */
html[data-office-skin] .weered-left-inner > div[style*="margin-top: auto"]{display:none!important;}

/* ============ SCROLLBARS ============ */
html[data-office-skin] *::-webkit-scrollbar-thumb{background:rgba(163,180,202,.24)!important;background-clip:padding-box!important;}
html[data-office-skin] *::-webkit-scrollbar-thumb:hover{background:rgba(163,180,202,.40)!important;background-clip:padding-box!important;}
html[data-office-skin] *::-webkit-scrollbar-track{background:rgba(255,255,255,.03)!important;}

/* ============ PRESENT-MODE FOCUS PULL ============ */
/* Another slice sets data-office-presenting on <html>; rails recede, the document
   holds the room. Single-property transitions, settle without overshoot. */
html[data-office-skin] .weered-left,html[data-office-skin] .weered-right{
  transition:opacity 380ms cubic-bezier(0.22,0.61,0.36,1),transform 380ms cubic-bezier(0.22,0.61,0.36,1);
}
html[data-office-skin][data-office-presenting] .weered-left,
html[data-office-skin][data-office-presenting] .weered-right{
  opacity:.25!important;transform:scale(.995)!important;pointer-events:none!important;
}
`;
