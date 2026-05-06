const css = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

  :root {
    --bg:#FAF7F2; --surface:#F5EDE0; --surface2:#EFE3D0;
    --primary:#D4713A; --primary-soft:#F0C4A0;
    --sage:#7A9E7E; --sage-soft:#C8DEC9;
    --text:#2C1A0E; --text-muted:#8C7060; --text-faint:#B8A090;
    --border:#E8D8C4; --shadow:rgba(44,26,14,.08); --shadow-md:rgba(44,26,14,.14);
    --bottom-nav-h: 64px;
  }

  .dark {
    --bg:#0F0E0C; --surface:#1A1714; --surface2:#231F1B;
    --primary:#E8834A; --primary-soft:#4A2810;
    --sage:#5A8060; --sage-soft:#1A2E1E;
    --text:#F0E8DC; --text-muted:#A09080; --text-faint:#5C5048;
    --border:#2E2820; --shadow:rgba(0,0,0,.3); --shadow-md:rgba(0,0,0,.5);
  }
  .dark body { background: var(--bg); color: var(--text); }
  .dark .login-shell { background: var(--bg); background-image: radial-gradient(circle at 20% 50%,rgba(232,131,74,.06) 0%,transparent 60%),radial-gradient(circle at 80% 20%,rgba(90,128,96,.06) 0%,transparent 50%); }
  .dark .login-card { background: var(--surface); }
  .dark .bottom-nav { background: rgba(15,14,12,.95); }
  .dark .feed-header { background: rgba(15,14,12,.92); }
  .dark .panel-bar   { background: rgba(15,14,12,.92); }
  .dark .reader-bar  { background: rgba(15,14,12,.92); }
  .dark .reader-hero { background: linear-gradient(160deg,#1A1714 0%,#3A2010 60%,#4A2810 100%); }
  .dark .profile-banner { background: linear-gradient(135deg,#1A1714 0%,#3A2010 50%,#4A2810 100%); }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;overflow:hidden;}
  body{background:var(--bg);font-family:'DM Sans',sans-serif;color:var(--text);}

  .login-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:var(--bg);background-image:radial-gradient(circle at 20% 50%,rgba(212,113,58,.07) 0%,transparent 60%),radial-gradient(circle at 80% 20%,rgba(122,158,126,.07) 0%,transparent 50%);}
  .login-card{width:100%;max-width:420px;padding:44px 36px;background:var(--bg);border:1px solid var(--border);border-radius:24px;box-shadow:0 8px 48px var(--shadow-md);text-align:center;animation:fadeUp .5s ease both;}
  .login-logo{font-family:'Fraunces',serif;font-size:42px;font-weight:700;color:var(--primary);letter-spacing:-1px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:9px;}
  .login-logo-dot{width:11px;height:11px;border-radius:50%;background:var(--primary);}
  .login-tagline{font-family:'Lora',serif;font-style:italic;font-size:16px;color:var(--text-muted);margin-bottom:30px;line-height:1.5;}
  .login-features{margin:0 0 24px;display:flex;flex-direction:column;gap:9px;text-align:left;}
  .login-feature{display:flex;align-items:flex-start;gap:9px;font-size:13px;color:var(--text-muted);line-height:1.4;}
  .login-feature-icon{width:20px;height:20px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px;border:1px solid var(--border);}
  .login-divider{width:36px;height:1px;background:var(--border);margin:0 auto 20px;}
  .login-btn{width:100%;padding:14px;background:var(--primary);color:white;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:12px;}
  .login-btn:hover{background:#C0622C;transform:translateY(-1px);box-shadow:0 6px 20px rgba(212,113,58,.35);}
  .login-btn:disabled{opacity:.6;cursor:wait;transform:none;}
  .login-note{font-size:11.5px;color:var(--text-faint);line-height:1.6;}
  .login-note a{color:var(--primary);text-decoration:none;}

  .app-shell{display:flex;height:100vh;height:100dvh;max-width:1180px;margin:0 auto;background:var(--bg);overflow:hidden;position:relative;}

  .sidebar{width:236px;padding:24px 12px;display:flex;flex-direction:column;gap:3px;border-right:1px solid var(--border);flex-shrink:0;height:100%;overflow-y:auto;transition:width .3s ease, padding .3s ease, opacity .3s ease;}
  .sidebar::-webkit-scrollbar{width:0;}
  .sidebar.collapsed{width:0;padding:0;opacity:0;pointer-events:none;overflow:hidden;}
  .logo{font-family:'Fraunces',serif;font-size:23px;font-weight:600;color:var(--primary);padding:4px 11px 15px;display:flex;align-items:center;gap:6px;letter-spacing:-.3px;white-space:nowrap;}
  .logo-dot{width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;cursor:pointer;font-size:14px;color:var(--text-muted);transition:all .15s;border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif;white-space:nowrap;}
  .nav-item:hover{background:var(--surface);color:var(--text);}
  .nav-item.active{background:var(--surface);color:var(--primary);font-weight:500;}
  .nav-icon{width:17px;height:17px;flex-shrink:0;opacity:.7;}
  .nav-item.active .nav-icon{opacity:1;}
  .nav-badge{margin-left:auto;background:var(--primary);color:white;border-radius:50px;font-size:10px;padding:1px 6px;font-weight:500;}
  .compose-btn{margin-top:10px;padding:10px;background:var(--primary);color:white;border:none;border-radius:50px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap;}
  .compose-btn:hover{background:#C0622C;transform:translateY(-1px);box-shadow:0 4px 16px rgba(212,113,58,.35);}
  .sidebar-profile{margin-top:auto;display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:11px;cursor:pointer;transition:background .15s;}
  .sidebar-profile:hover{background:var(--surface);}
  .sidebar-av{width:32px;height:32px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:13px;color:var(--primary);flex-shrink:0;overflow:hidden;}
  .sidebar-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .sidebar-name{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .sidebar-npub{font-size:9px;color:var(--text-faint);font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .logout-btn{margin-top:5px;width:100%;padding:7px;background:none;border:1px solid var(--border);border-radius:9px;color:var(--text-faint);font-family:'DM Sans',sans-serif;font-size:11.5px;cursor:pointer;transition:all .15s;}
  .logout-btn:hover{border-color:var(--primary);color:var(--primary);}
  .dark-toggle{margin-top:5px;width:100%;padding:7px;background:none;border:1px solid var(--border);border-radius:9px;color:var(--text-faint);font-family:'DM Sans',sans-serif;font-size:11.5px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px;}
  .dark-toggle:hover{border-color:var(--primary);color:var(--primary);}

  .bottom-profile-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 16px;border:none;background:none;cursor:pointer;position:relative;flex-shrink:0;}
  .bottom-profile-av{width:40px;height:40px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:15px;color:var(--primary);overflow:hidden;flex-shrink:0;border:2px solid transparent;transition:border-color .15s;margin-top:-6px;}
  .bottom-profile-av.active{border-color:var(--primary);}
  .bottom-profile-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .bottom-settings-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 16px;border:none;background:none;cursor:pointer;color:var(--text-faint);transition:color .15s;font-family:'DM Sans',sans-serif;}
  .bottom-settings-btn svg{width:22px;height:22px;}
  .bottom-settings-btn span{font-size:10px;}
  .bottom-settings-btn.active{color:var(--primary);}

  .settings-row{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;}
  @media(hover:hover){.settings-row:hover{background:var(--surface);}}
  .settings-row-label{font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text);}
  .settings-row-sub{font-size:11px;color:var(--text-faint);margin-top:1px;}
  .settings-section-title{padding:20px 20px 6px;font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--text-faint);font-family:'DM Sans',sans-serif;font-weight:500;}

  .toggle{position:relative;width:44px;height:26px;flex-shrink:0;}
  .toggle input{opacity:0;width:0;height:0;}
  .toggle-track{position:absolute;inset:0;border-radius:50px;background:var(--border);transition:background .2s;cursor:pointer;}
  .toggle input:checked + .toggle-track{background:var(--primary);}
  .toggle-thumb{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:white;transition:transform .2s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.2);}
  .toggle input:checked ~ .toggle-thumb{transform:translateX(18px);}

  .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;height:var(--bottom-nav-h);background:rgba(250,247,242,.96);backdrop-filter:blur(14px);border-top:1px solid var(--border);z-index:80;padding:0 4px;padding-bottom:env(safe-area-inset-bottom);overflow:visible;}
  .bottom-nav-inner{display:flex;align-items:center;justify-content:space-around;height:100%;}
  .bottom-nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 16px;border:none;background:none;cursor:pointer;color:var(--text-faint);transition:color .15s;position:relative;font-family:'DM Sans',sans-serif;}
  .bottom-nav-item.active{color:var(--primary);}
  .bottom-nav-item svg{width:22px;height:22px;}
  .bottom-nav-label{font-size:10px;font-weight:400;}
  .bottom-nav-badge{position:absolute;top:4px;right:10px;background:var(--primary);color:white;border-radius:50px;font-size:9px;padding:0px 5px;font-weight:500;min-width:16px;text-align:center;}

  .view-container{flex:1;display:flex;overflow:hidden;position:relative;min-width:0;}
  .feed-view{display:flex;width:100%;overflow:hidden;transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .28s ease;}
  .feed-view.slide-out{transform:translateX(-48px);opacity:0;pointer-events:none;}
  .feed-main{flex:1;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;min-width:0;}
  .feed-header{padding:13px 18px 10px;border-bottom:1px solid var(--border);background:rgba(250,247,242,.94);backdrop-filter:blur(12px);flex-shrink:0;}
  .feed-title{font-family:'Fraunces',serif;font-size:18px;font-weight:600;letter-spacing:-.2px;}
  .feed-subtitle{font-size:11px;color:var(--text-faint);margin-top:1px;}
  .feed-scroll{flex:1;overflow-y:auto;}
  .feed-scroll::-webkit-scrollbar{width:0;}

  .skel-card{padding:14px 18px;border-bottom:1px solid var(--border);}
  .skel-row{display:flex;gap:9px;}
  .skel{background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:6px;}
  @keyframes shimmer{to{background-position:-200% 0;}}
  .skel-av{width:36px;height:36px;border-radius:50%;flex-shrink:0;}
  .skel-lines{flex:1;display:flex;flex-direction:column;gap:6px;padding-top:3px;}
  .skel-line{height:11px;}

  .compose-box{padding:12px 18px;border-bottom:1px solid var(--border);display:flex;gap:9px;}
  .compose-av{width:36px;height:36px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:15px;color:var(--primary);flex-shrink:0;overflow:hidden;}
  .compose-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .compose-right{flex:1;min-width:0;}
  .compose-input{width:100%;background:none;border:none;outline:none;font-family:'Lora',serif;font-size:14.5px;color:var(--text);resize:none;min-height:48px;line-height:1.6;}
  .compose-input::placeholder{color:var(--text-faint);}
  .compose-footer{display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid var(--border);}
  .char-count{font-size:10.5px;color:var(--text-faint);}
  .char-count.warn{color:#E05C8A;}
  .post-btn{padding:6px 16px;background:var(--primary);color:white;border:none;border-radius:50px;font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:500;cursor:pointer;transition:all .2s;}
  .post-btn:disabled{opacity:.4;cursor:default;}
  .post-btn:not(:disabled):hover{background:#C0622C;transform:translateY(-1px);}

  .note-card,.longform-card{padding:13px 18px;border-bottom:1px solid var(--border);cursor:pointer;animation:fadeUp .3s ease both;}
  .note-card.hovered,.longform-card.hovered{background:rgba(245,237,224,.45);}
  @keyframes fadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  .note-inner{display:flex;gap:9px;}
  .avatar{width:36px;height:36px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:14px;font-weight:600;color:var(--text-muted);flex-shrink:0;overflow:hidden;}
  .avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .note-body{flex:1;min-width:0;}
  .note-meta{display:flex;align-items:baseline;gap:5px;margin-bottom:3px;flex-wrap:wrap;}
  .note-name{font-size:13px;font-weight:500;}
  .note-npub{font-size:10.5px;color:var(--primary);opacity:.75;}
  .note-time{font-size:10.5px;color:var(--text-faint);margin-left:auto;}
  .note-text{font-family:'Lora',serif;font-size:14px;line-height:1.65;color:var(--text);margin-bottom:8px;word-break:break-word;white-space:pre-wrap;}
  .note-actions{display:flex;gap:12px;}
  .action-btn{display:flex;align-items:center;gap:3px;font-size:11px;color:var(--text-faint);cursor:pointer;padding:3px 4px;border-radius:6px;transition:all .12s;border:none;background:none;font-family:'DM Sans',sans-serif;}
  .action-btn:hover{color:var(--primary);background:rgba(212,113,58,.07);}
  .action-btn.liked{color:#E05C8A;}
  .action-btn.saved{color:var(--primary);}
  .lf-author-row{display:flex;align-items:center;gap:6px;margin-bottom:8px;}
  .lf-av{width:22px;height:22px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:9px;color:var(--text-muted);flex-shrink:0;overflow:hidden;}
  .lf-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .lf-author-name{font-size:11.5px;font-weight:500;color:var(--text-muted);}
  .lf-time{font-size:10px;color:var(--text-faint);margin-left:auto;}
  .lf-inner{background:var(--surface);border-radius:14px;overflow:hidden;border:1px solid var(--border);transition:box-shadow .2s,transform .2s;}
  .longform-card:hover .lf-inner{box-shadow:0 4px 18px var(--shadow-md);transform:translateY(-1px);}
  .lf-placeholder{width:100%;height:130px;background:linear-gradient(135deg,var(--surface2) 0%,var(--primary-soft) 100%);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:28px;color:var(--primary);font-style:italic;opacity:.4;}
  .lf-body{padding:11px 13px;}
  .lf-tag{display:inline-block;font-size:9px;font-weight:500;color:var(--primary);background:rgba(212,113,58,.1);padding:2px 7px;border-radius:50px;margin-bottom:4px;letter-spacing:.3px;text-transform:uppercase;}
  .lf-title{font-family:'Fraunces',serif;font-size:15px;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:3px;}
  .lf-summary{font-family:'Lora',serif;font-size:12px;line-height:1.5;color:var(--text-muted);margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .lf-footer{display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);}
  .lf-readtime{font-size:10px;color:var(--text-faint);display:flex;align-items:center;gap:2px;}
  .lf-actions{display:flex;gap:2px;}

  .right-panel{width:260px;padding:16px 12px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex-shrink:0;}
  .right-panel::-webkit-scrollbar{width:0;}
  .panel-card{background:var(--surface);border-radius:13px;padding:13px;border:1px solid var(--border);}
  .panel-title{font-family:'Fraunces',serif;font-size:13.5px;font-weight:600;margin-bottom:10px;}
  .relay-item{display:flex;align-items:center;font-size:10px;color:var(--text-muted);padding:3px 0;font-family:monospace;}
  .relay-dot{width:5px;height:5px;border-radius:50%;background:var(--sage);margin-right:5px;box-shadow:0 0 0 2px var(--sage-soft);flex-shrink:0;}

  .slide-panel{position:absolute;inset:0;background:var(--bg);z-index:20;transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .28s ease;transform:translateX(100%);opacity:0;overflow:hidden;}
  .slide-panel.open{transform:translateX(0);opacity:1;}
  .slide-panel-scroll{height:100%;overflow-y:auto;}
  .slide-panel-scroll::-webkit-scrollbar{width:0;}

  .panel-bar{position:sticky;top:0;background:rgba(250,247,242,.93);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);height:50px;display:flex;align-items:center;padding:0 18px;gap:10px;z-index:50;flex-shrink:0;}
  .back-btn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;cursor:pointer;border:none;background:none;padding:0;border-radius:50%;transition:all .15s;color:var(--text-muted);flex-shrink:0;}
  .back-btn:hover{background:var(--surface);color:var(--text);}
  .panel-bar-logo{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:var(--primary);margin-right:auto;}
  .icon-btn{width:32px;height:32px;border-radius:50%;border:none;background:none;cursor:pointer;color:var(--text-muted);display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:var(--surface);}
  .icon-btn.r-liked{color:#E05C8A;}
  .icon-btn.r-saved{color:var(--primary);}

  .read-progress{position:fixed;top:0;left:0;height:3px;background:var(--primary);transition:width .1s linear;z-index:100;border-radius:0 2px 2px 0;}
  .reader-hero{width:100%;height:200px;background:linear-gradient(160deg,var(--surface2) 0%,var(--primary-soft) 60%,#E8B090 100%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0;}
  .reader-hero-glyph{font-family:'Fraunces',serif;font-size:120px;color:rgba(212,113,58,.13);font-style:italic;user-select:none;line-height:1;}
  .reader-hero-tag{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);font-size:9.5px;font-weight:500;color:var(--primary);background:rgba(250,247,242,.92);padding:3px 11px;border-radius:50px;letter-spacing:.8px;text-transform:uppercase;backdrop-filter:blur(8px);border:1px solid var(--border);}
  .reader-content{max-width:640px;margin:0 auto;padding:0 20px 80px;}
  .reader-header{padding:28px 0 20px;border-bottom:1px solid var(--border);margin-bottom:26px;animation:fadeUp .4s ease both;}
  .reader-title{font-family:'Fraunces',serif;font-size:28px;font-weight:700;line-height:1.15;letter-spacing:-.6px;margin-bottom:10px;}
  .reader-summary{font-family:'Lora',serif;font-size:15px;font-style:italic;line-height:1.6;color:var(--text-muted);margin-bottom:16px;}
  .reader-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
  .r-author-row{display:flex;align-items:center;gap:7px;cursor:pointer;}
  .r-av{width:34px;height:34px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:14px;color:var(--primary);outline:2px solid var(--primary);outline-offset:2px;overflow:hidden;}
  .r-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .r-author-name{font-size:13px;font-weight:500;}
  .r-author-npub{font-size:9px;color:var(--text-faint);font-family:monospace;}
  .meta-sep{width:1px;height:22px;background:var(--border);}
  .meta-pill{font-size:10.5px;color:var(--text-faint);display:flex;align-items:center;gap:2px;}
  .reader-body{animation:fadeUp .5s ease .1s both;}
  .reader-body p{font-family:'Lora',serif;font-size:16.5px;line-height:1.82;color:var(--text);margin-bottom:1.3em;}
  .reader-body h2{font-family:'Fraunces',serif;font-size:22px;font-weight:600;line-height:1.25;margin:1.7em 0 .5em;letter-spacing:-.2px;}
  .reader-body blockquote{border-left:3px solid var(--primary);margin:1.5em 0;padding:2px 0 2px 18px;}
  .reader-body blockquote p{font-family:'Fraunces',serif;font-size:18px;font-style:italic;font-weight:300;color:var(--text-muted);margin:0;line-height:1.5;}
  .reader-body .drop-cap::first-letter{font-family:'Fraunces',serif;font-size:4.4em;font-weight:700;float:left;line-height:.78;margin:.07em 7px 0 -1px;color:var(--primary);}
  .section-div{text-align:center;color:var(--primary);font-size:15px;letter-spacing:9px;margin:1.8em 0;opacity:.4;}
  .reader-footer{border-top:1px solid var(--border);padding:22px 0 0;animation:fadeUp .5s ease .2s both;}
  .reactions-row{display:flex;align-items:center;gap:7px;padding:12px 14px;background:var(--surface);border-radius:12px;border:1px solid var(--border);margin-bottom:16px;flex-wrap:wrap;}
  .reactions-label{font-size:11.5px;color:var(--text-muted);margin-right:2px;}
  .rx-btn{display:flex;align-items:center;gap:3px;padding:5px 10px;border-radius:50px;border:1.5px solid var(--border);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:12px;color:var(--text-muted);cursor:pointer;transition:all .15s;}
  .rx-btn:hover{border-color:var(--primary);color:var(--primary);}
  .rx-btn.rx-active{background:var(--primary);border-color:var(--primary);color:white;}
  .rx-btn.rx-liked.rx-active{background:#E05C8A;border-color:#E05C8A;}
  .author-card{background:var(--surface);border-radius:13px;padding:16px;display:flex;gap:12px;border:1px solid var(--border);margin-bottom:14px;}
  .author-card-av{width:44px;height:44px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:18px;color:var(--primary);outline:2px solid var(--primary);outline-offset:2px;flex-shrink:0;overflow:hidden;}
  .author-card-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .author-card-label{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-faint);margin-bottom:2px;}
  .author-card-name{font-family:'Fraunces',serif;font-size:16px;font-weight:600;margin-bottom:4px;}
  .author-card-bio{font-family:'Lora',serif;font-size:12.5px;line-height:1.5;color:var(--text-muted);margin-bottom:10px;}
  .follow-author-btn{padding:6px 16px;border-radius:50px;border:1.5px solid var(--primary);background:none;color:var(--primary);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;}
  .follow-author-btn:hover{background:var(--primary);color:white;}
  .event-id-label{font-size:8.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-faint);margin-bottom:3px;}
  .event-id{font-family:monospace;font-size:9px;color:var(--text-faint);background:var(--surface);padding:7px 10px;border-radius:7px;border:1px solid var(--border);word-break:break-all;line-height:1.6;}

  .profile-banner{width:100%;height:130px;background:linear-gradient(135deg,var(--surface2) 0%,var(--primary-soft) 50%,#E8C4A0 100%);position:relative;overflow:hidden;flex-shrink:0;}
  .profile-banner-glyph{position:absolute;right:-20px;bottom:-30px;font-family:'Fraunces',serif;font-size:160px;color:rgba(212,113,58,.1);font-style:italic;line-height:1;user-select:none;}
  .profile-identity{padding:0 20px 0;margin-top:-26px;position:relative;z-index:2;}
  .profile-av-wrap{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:12px;}
  .profile-av{width:64px;height:64px;border-radius:50%;background:var(--primary-soft);border:3px solid var(--bg);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:25px;color:var(--primary);flex-shrink:0;overflow:hidden;}
  .profile-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .profile-edit-btn{padding:6px 14px;border-radius:50px;border:1.5px solid var(--border);background:none;color:var(--text-muted);font-family:'DM Sans',sans-serif;font-size:11.5px;cursor:pointer;transition:all .15s;}
  .profile-edit-btn:hover{border-color:var(--primary);color:var(--primary);}
  .profile-name{font-family:'Fraunces',serif;font-size:22px;font-weight:700;letter-spacing:-.3px;margin-bottom:2px;}
  .profile-nip05{font-size:11.5px;color:var(--primary);display:flex;align-items:center;gap:3px;margin-bottom:6px;}
  .profile-nip05-dot{width:5px;height:5px;border-radius:50%;background:var(--primary);}
  .profile-npub{font-family:monospace;font-size:9.5px;color:var(--text-faint);margin-bottom:8px;display:flex;align-items:center;gap:5px;}
  .profile-about{font-family:'Lora',serif;font-size:13.5px;line-height:1.6;color:var(--text-muted);margin-bottom:14px;}
  .profile-stats{display:flex;gap:0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
  .profile-stat{flex:1;padding:12px 16px;text-align:center;cursor:pointer;transition:background .15s;border-right:1px solid var(--border);}
  .profile-stat:last-child{border-right:none;}
  .profile-stat:hover,.profile-stat.active{background:var(--surface);}
  .profile-stat-val{font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:var(--text);line-height:1;}
  .profile-stat-label{font-size:9.5px;color:var(--text-faint);margin-top:2px;text-transform:uppercase;letter-spacing:.5px;}

  .circle-header{padding:16px 20px 4px;}
  .circle-headline{font-family:'Fraunces',serif;font-size:24px;font-weight:700;color:var(--text);letter-spacing:-.4px;line-height:1.2;}
  .circle-headline span{color:var(--primary);}
  .circle-subline{font-family:'Lora',serif;font-style:italic;font-size:12px;color:var(--text-faint);margin-top:3px;}
  .circle-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;}
  .circle-card{padding:13px 16px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);cursor:pointer;transition:background .12s;animation:fadeUp .28s ease both;}
  .circle-card:nth-child(even){border-right:none;}
  .circle-card:hover{background:rgba(245,237,224,.45);}
  .circle-card-inner{display:flex;gap:9px;align-items:flex-start;}
  .circle-card-av{width:40px;height:40px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:16px;color:var(--primary);flex-shrink:0;overflow:hidden;outline:2px solid transparent;outline-offset:2px;transition:outline-color .15s;}
  .circle-card:hover .circle-card-av{outline-color:var(--primary);}
  .circle-card-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .circle-card-info{flex:1;min-width:0;}
  .circle-card-name{font-size:12.5px;font-weight:500;color:var(--text);margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .circle-card-nip05{font-size:9.5px;color:var(--sage);display:flex;align-items:center;gap:2px;margin-bottom:3px;}
  .circle-card-about{font-family:'Lora',serif;font-size:11px;color:var(--text-muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .circle-card-npub{font-family:monospace;font-size:8.5px;color:var(--text-faint);margin-top:3px;}

  .empty-state{padding:48px 20px;text-align:center;}
  .empty-state-title{font-family:'Fraunces',serif;font-size:18px;color:var(--text-muted);margin-bottom:5px;}
  .empty-state-sub{font-size:12px;color:var(--text-faint);}

  .thread-note{padding:13px 18px;border-bottom:1px solid var(--border);transition:background .12s;}
  .thread-note.focused{background:rgba(212,113,58,.04);border-left:3px solid var(--primary);}
  .thread-note.parent{opacity:.85;cursor:pointer;}
  @media(hover:hover){.thread-note.parent:hover,.thread-note.reply:hover{background:rgba(245,237,224,.35);}.thread-reply-note:hover{background:rgba(245,237,224,.45);}}
  .thread-note.reply{cursor:pointer;}
  .thread-note.has-connector{border-bottom:none;padding-bottom:4px;}
  .thread-connector{padding: 0 18px 0 35px;display:flex;align-items:stretch;}
  .thread-connector-line{width:2px;min-height:12px;background:var(--border);flex-shrink:0;}
  .thread-connector-line.chain{background:rgba(212,113,58,.35);}
  .thread-replies-label{padding:12px 18px 4px;font-size:10.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.6px;font-weight:500;border-top:1px solid var(--border);}
  .thread-reply-note{padding:13px 18px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;}

  .note-stats{display:flex;align-items:center;gap:0;margin-bottom:8px;}
  .note-stats.focused{border:none;}
  .note-stat-btn{display:flex;align-items:center;gap:4px;padding:4px 12px 4px 0;font-family:'DM Sans',sans-serif;font-size:11.5px;font-weight:500;color:var(--text-muted);cursor:pointer;border:none;background:none;transition:color .12s;white-space:nowrap;}
  .note-stat-btn:hover{color:var(--primary);}
  .note-stat-val{font-family:'Fraunces',serif;font-size:13px;font-weight:600;color:var(--text);}
  .note-stats.focused .note-stat-btn{padding:6px 14px 6px 0;font-size:12px;}
  .note-stats.focused .note-stat-val{font-size:13.5px;}

  .list-row{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;}
  .list-row:hover{background:rgba(245,237,224,.45);}
  .list-row-av{width:40px;height:40px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:16px;color:var(--text-muted);flex-shrink:0;overflow:hidden;}
  .list-row-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .list-row-av.top{outline:2px solid var(--primary);outline-offset:2px;}
  .list-row-name{font-size:13.5px;font-weight:500;color:var(--text);flex:1;min-width:0;}
  .list-row-meta{font-family:'Lora',serif;font-style:italic;font-size:12px;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .list-row-right{font-family:'Fraunces',serif;font-size:15px;font-weight:600;color:var(--primary);flex-shrink:0;}
  .list-badge{font-size:10px;background:rgba(212,113,58,.12);color:var(--primary);padding:1px 7px;border-radius:50px;font-weight:500;margin-left:6px;font-family:'DM Sans',sans-serif;}
  .zap-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:8px;}
  .zap-badge{display:flex;align-items:center;gap:0;border-radius:50px;overflow:hidden;border:1px solid var(--border);background:var(--surface);cursor:default;transition:transform .15s;flex-shrink:0;}
  .zap-badge:hover{transform:translateY(-1px);}
  .zap-badge-av{width:20px;height:20px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:8px;font-weight:600;color:var(--text-muted);overflow:hidden;flex-shrink:0;margin:2px 0 2px 2px;}
  .zap-badge-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .zap-badge-amt{font-family:'DM Sans',sans-serif;font-size:10.5px;font-weight:500;color:var(--primary);padding:0 7px 0 4px;display:flex;align-items:center;gap:2px;}
  .zap-badge-top{display:inline-flex;align-items:center;gap:0;border-radius:50px;overflow:hidden;border:1.5px solid rgba(212,113,58,.35);background:rgba(212,113,58,.07);flex-shrink:0;transition:transform .15s;align-self:flex-start;}
  .zap-badge-top:hover{transform:translateY(-1px);}
  .zap-badge-top-av{width:24px;height:24px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:10px;font-weight:600;color:var(--primary);overflow:hidden;flex-shrink:0;margin:3px 0 3px 3px;}
  .zap-badge-top-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .zap-badge-top-body{padding:0 10px 0 5px;}
  .zap-badge-top-amt{font-family:'DM Sans',sans-serif;font-size:11.5px;font-weight:600;color:var(--primary);display:flex;align-items:center;gap:3px;line-height:1.2;}
  .zap-badge-top-comment{font-family:'Lora',serif;font-size:10px;font-style:italic;color:var(--text-muted);line-height:1.2;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;}

  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:300;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .15s ease;}
  .overlay.centered{align-items:center;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}

  .action-sheet{width:100%;max-width:480px;background:var(--bg);border-radius:20px 20px 0 0;padding:8px 0 calc(env(safe-area-inset-bottom) + 16px);animation:slideUp .22s cubic-bezier(.4,0,.2,1);}
  @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
  .action-sheet-handle{width:36px;height:4px;background:var(--border);border-radius:2px;margin:8px auto 14px;}
  .action-sheet-title{font-size:11px;color:var(--text-faint);text-align:center;margin-bottom:6px;padding:0 20px;text-transform:uppercase;letter-spacing:.5px;}
  .action-sheet-btn{display:flex;align-items:center;gap:14px;width:100%;padding:14px 24px;background:none;border:none;font-family:'DM Sans',sans-serif;font-size:15px;color:var(--text);cursor:pointer;transition:background .12s;text-align:left;}
  .action-sheet-btn:hover{background:var(--surface);}
  .action-sheet-btn-icon{width:36px;height:36px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;}
  .action-sheet-cancel{margin:6px 16px 0;padding:13px;background:var(--surface);border:none;border-radius:14px;width:calc(100% - 32px);font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;color:var(--text-muted);cursor:pointer;transition:background .12s;}
  .action-sheet-cancel:hover{background:var(--surface2);}

  .overlay.compose-overlay{align-items:flex-end;height:100%;height:100dvh;}
  .compose-sheet{width:100%;max-width:580px;background:var(--bg);border-radius:20px 20px 0 0;display:flex;flex-direction:column;max-height:90dvh;animation:slideUp .22s cubic-bezier(.4,0,.2,1);}
  .compose-sheet-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--border);flex-shrink:0;}
  .compose-sheet-cancel{background:none;border:none;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text-muted);cursor:pointer;padding:4px 8px;border-radius:8px;}
  .compose-sheet-cancel:hover{background:var(--surface);}
  .compose-sheet-title{font-family:'Fraunces',serif;font-size:15px;font-weight:600;color:var(--text);}
  .compose-sheet-post{padding:7px 18px;background:var(--primary);color:white;border:none;border-radius:50px;font-family:'DM Sans',sans-serif;font-size:13.5px;font-weight:500;cursor:pointer;transition:all .2s;}
  .compose-sheet-post:disabled{opacity:.4;cursor:default;}
  .compose-sheet-post:not(:disabled):hover{background:#C0622C;}
  .compose-sheet-context{padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;}
  .compose-sheet-context-label{font-size:9.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;}
  .compose-sheet-body{flex:1;display:flex;gap:10px;padding:14px 16px;overflow-y:auto;}
  .compose-sheet-av{width:36px;height:36px;border-radius:50%;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:15px;color:var(--primary);flex-shrink:0;}
  .compose-sheet-input{flex:1;background:none;border:none;outline:none;resize:none;font-family:'Lora',serif;font-size:15px;color:var(--text);line-height:1.6;min-height:80px;}
  .compose-sheet-input::placeholder{color:var(--text-faint);}
  .compose-sheet-footer{padding:8px 16px 4px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0;}
  .compose-media-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;border:none;background:none;cursor:pointer;color:var(--text-muted);transition:background .12s,color .12s;font-size:16px;flex-shrink:0;}
  .compose-media-btn:hover{background:var(--surface);color:var(--primary);}
  .compose-char-count{margin-left:auto;font-size:11px;color:var(--text-faint);}
  .compose-char-count.warn{color:#E05C8A;}
  .compose-previews{display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px 0;flex-shrink:0;}
  .compose-preview{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--border);}
  .compose-preview img{display:block;height:90px;max-width:160px;object-fit:cover;}
  .compose-preview-remove{position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.55);color:white;border:none;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;}
  .compose-upload-status{font-size:11px;color:var(--text-faint);font-family:'DM Sans',sans-serif;padding:4px 16px;flex-shrink:0;}

  .gif-picker{flex-shrink:0;border-top:1px solid var(--border);background:var(--surface);max-height:240px;overflow-y:auto;}
  .gif-search-row{display:flex;gap:8px;padding:10px 12px;position:sticky;top:0;background:var(--surface);z-index:1;}
  .gif-search-input{flex:1;padding:7px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg);font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text);outline:none;transition:border-color .15s;}
  .gif-search-input:focus{border-color:var(--primary);}
  .gif-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:0 8px 8px;}
  .gif-item{border-radius:8px;overflow:hidden;cursor:pointer;aspect-ratio:1;background:var(--surface2);}
  .gif-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .15s;}
  .gif-item:hover img{transform:scale(1.05);}

  .zap-modal{width:calc(100% - 40px);max-width:360px;background:var(--bg);border-radius:20px;padding:24px 20px 20px;animation:popIn .2s cubic-bezier(.4,0,.2,1);box-shadow:0 8px 40px var(--shadow-md);}
  @keyframes popIn{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
  .zap-modal-title{font-family:'Fraunces',serif;font-size:18px;font-weight:600;color:var(--text);margin-bottom:3px;}
  .zap-modal-sub{font-size:12px;color:var(--text-faint);margin-bottom:16px;}
  .zap-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
  .zap-preset{padding:10px 4px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface);font-family:'Fraunces',serif;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;transition:all .15s;text-align:center;}
  .zap-preset:hover,.zap-preset.sel{border-color:var(--primary);background:rgba(212,113,58,.08);color:var(--primary);}
  .zap-preset-label{display:block;font-family:'DM Sans',sans-serif;font-size:9px;color:var(--text-faint);font-weight:400;margin-top:2px;}
  .zap-custom-row{display:flex;gap:8px;margin-bottom:10px;}
  .zap-input{flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text);outline:none;transition:border-color .15s;width:100%;box-sizing:border-box;}
  .zap-input:focus{border-color:var(--primary);}
  .zap-input::placeholder{color:var(--text-faint);}
  .zap-msg{font-family:'Lora',serif;font-size:13px;resize:none;min-height:48px;line-height:1.5;}
  .zap-send-btn{width:100%;padding:13px;background:var(--primary);color:white;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;transition:all .2s;margin-top:12px;}
  .zap-send-btn:hover{background:#C0622C;transform:translateY(-1px);}
  .zap-cancel{width:100%;padding:10px;background:none;border:none;font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text-muted);cursor:pointer;margin-top:6px;}

  .emoji-picker{background:var(--bg);border-radius:20px 20px 0 0;padding:16px 16px calc(env(safe-area-inset-bottom) + 16px);animation:slideUp .2s cubic-bezier(.4,0,.2,1);width:100%;max-width:480px;}
  .emoji-picker-title{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-bottom:12px;}
  .emoji-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
  .emoji-btn{font-size:22px;padding:8px 4px;border:none;background:none;border-radius:10px;cursor:pointer;transition:background .12s;text-align:center;}
  .emoji-btn:hover{background:var(--surface);}
  .action-btn.reacted{color:var(--primary);}

  .toast{position:fixed;bottom:calc(var(--bottom-nav-h) + 10px);left:50%;transform:translateX(-50%) translateY(14px);background:var(--text);color:var(--bg);padding:8px 16px;border-radius:50px;font-size:12px;font-family:'DM Sans',sans-serif;opacity:0;transition:all .2s;pointer-events:none;z-index:200;white-space:nowrap;}
  .toast.show{opacity:1;transform:translateX(-50%) translateY(0);}

  .ix-note{padding:13px 18px;border-bottom:1px solid var(--border);animation:fadeUp .28s ease both;}
  .ix-note:hover{background:rgba(245,237,224,.35);}
  .ix-inner{display:flex;gap:9px;}
  .ix-line-wrap{display:flex;flex-direction:column;align-items:center;flex-shrink:0;}
  .ix-av{width:34px;height:34px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:13px;font-weight:600;color:var(--text-muted);flex-shrink:0;overflow:hidden;}
  .ix-av img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
  .ix-av.is-me{background:var(--primary-soft);color:var(--primary);}
  .ix-connector{width:1px;flex:1;background:var(--border);margin-top:4px;min-height:12px;}
  .ix-body{flex:1;min-width:0;padding-top:1px;}
  .ix-meta{display:flex;align-items:baseline;gap:5px;margin-bottom:3px;flex-wrap:wrap;}
  .ix-name{font-size:13px;font-weight:500;}
  .ix-name.is-me{color:var(--primary);}
  .ix-time{font-size:10px;color:var(--text-faint);margin-left:auto;}
  .ix-you-badge{font-size:9px;font-weight:500;color:var(--primary);background:rgba(212,113,58,.1);padding:1px 6px;border-radius:50px;letter-spacing:.2px;}
  .ix-text{font-family:'Lora',serif;font-size:13.5px;line-height:1.6;color:var(--text);word-break:break-word;white-space:pre-wrap;}
  .ix-mention{color:var(--primary);font-weight:500;}
  .ix-direction{display:flex;align-items:center;gap:4px;font-size:9.5px;color:var(--text-faint);margin-bottom:3px;}
  .ix-dir-arrow{font-size:10px;}

  @media (max-width: 767px) {
    .bottom-nav { display: block; }
    .sidebar { display: none; }
    .right-panel { display: none; }
    .feed-main { border-right: none; }
    .feed-scroll { padding-bottom: var(--bottom-nav-h); }
    .slide-panel-scroll { padding-bottom: var(--bottom-nav-h); }
    .reader-hero { height: 160px; }
    .reader-hero-glyph { font-size: 90px; }
    .reader-title { font-size: 24px; }
    .circle-grid { grid-template-columns: 1fr; }
    .circle-card { border-right: none !important; }
    .toast { bottom: calc(var(--bottom-nav-h) + 14px); }
  }
  @media (min-width: 768px) and (max-width: 1023px) {
    .right-panel { display: none; }
    .feed-main { border-right: none; }
    .sidebar { width: 200px; }
  }
  @media (min-width: 1024px) {
    .toast { bottom: 26px; }
  }
`;

export default css;
