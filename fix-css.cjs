const fs = require('fs');
const content = fs.readFileSync('src/styles/global.css', 'utf8');
const lines = content.split('\n');

// Keep lines 0-1036 (first 1037 lines, indices 0..1036)
const beforeBlock = lines.slice(0, 1037).join('\n');

const newBlock = `

/* ========================================================
   LIGHT MODE REFINEMENT - deeper canvas, dark visible lines,
   richer colour. Overrides earlier light tokens (cascade wins).
   ======================================================== */
html.light, .light {
  --color-bg-page:     #dfe5ee;
  --color-bg-card:     #f4f7fb;
  --color-bg-elevated: #e9eef6;
  --color-bg-hover:    #dce4f0;
  --color-bg-sunken:   #ced7e6;

  --color-border-subtle:  #9aa9bf;
  --color-border-default: #6b7d99;
  --color-border-hover:   #4f6285;
  --color-border-active:  #364a6b;
  --color-border-strong:  #1f2d44;
  --color-divider-dark:   #2a3a55;

  --color-text-primary:   #0b1424;
  --color-text-secondary: #2c3a52;
  --color-text-tertiary:  #4a5a74;
  --color-text-muted:     #6c7c95;

  --color-accent-blue:       #1d4ed8;
  --color-accent-blue-soft:  rgba(29, 78, 216, 0.16);
  --color-accent-blue-glow:  rgba(29, 78, 216, 0.30);
  --color-accent-green:      #0f7a3d;
  --color-accent-green-soft: rgba(15, 122, 61, 0.15);
  --color-accent-green-glow: rgba(15, 122, 61, 0.28);
  --color-accent-amber:      #c2660a;
  --color-accent-amber-soft: rgba(194, 102, 10, 0.15);
  --color-accent-amber-glow: rgba(194, 102, 10, 0.28);
  --color-accent-red:        #c81e1e;
  --color-accent-red-soft:   rgba(200, 30, 30, 0.15);
  --color-accent-red-glow:   rgba(200, 30, 30, 0.30);
  --color-accent-purple:      #6d28d9;
  --color-accent-purple-soft: rgba(109, 40, 217, 0.15);
  --color-accent-purple-glow: rgba(109, 40, 217, 0.28);
  --color-accent-cyan:       #0e7490;
  --color-accent-cyan-soft:  rgba(14, 116, 144, 0.15);
  --color-accent-cyan-glow:  rgba(14, 116, 144, 0.28);

  --color-risk-low:             #0f7a3d;
  --color-risk-low-bg:          #d4f0df;
  --color-risk-low-border:      #0f7a3d;
  --color-risk-moderate:        #c2660a;
  --color-risk-moderate-bg:     #fdeccf;
  --color-risk-moderate-border: #c2660a;
  --color-risk-high:            #d4480a;
  --color-risk-high-bg:         #fcdcc7;
  --color-risk-high-border:     #d4480a;
  --color-risk-critical:        #c81e1e;
  --color-risk-critical-bg:     #f9d2d2;
  --color-risk-critical-border: #c81e1e;

  --shadow-card:
    0 0 0 1px #6b7d99 inset,
    0px 1px 2px rgba(20, 35, 60, 0.12),
    0px 2px 6px rgba(20, 35, 60, 0.10);
  --shadow-card-elevated:
    0 0 0 1px #4f6285 inset,
    0px 4px 12px rgba(20, 35, 60, 0.16),
    0px 12px 28px rgba(20, 35, 60, 0.12);
  --shadow-elevated:
    0 0 0 1px #6b7d99 inset,
    0px 3px 8px rgba(20, 35, 60, 0.14),
    0px 10px 22px rgba(20, 35, 60, 0.10);
  --shadow-float:
    0 0 0 1px #4f6285 inset,
    0px 4px 10px rgba(20, 35, 60, 0.14),
    0px 12px 30px rgba(20, 35, 60, 0.14),
    0px 28px 56px rgba(20, 35, 60, 0.10);
  --shadow-modal:
    0 0 0 1px #4f6285 inset,
    0px 2px 6px rgba(20, 35, 60, 0.16),
    0px 12px 28px rgba(20, 35, 60, 0.18),
    0px 28px 56px rgba(20, 35, 60, 0.16);

  --color-divider:         #6b7d99;
  --color-focus-ring:      rgba(29, 78, 216, 0.55);
  --color-input-border:    #6b7d99;
  --color-input-focus:     #1d4ed8;
  --color-scrollbar:       #6b7d99;
  --color-scrollbar-hover: #364a6b;
  --color-sidebar-bg:      #e9eef6;
  --color-sidebar-border:  #6b7d99;
}

html.light ::selection, .light ::selection {
  background: rgba(29, 78, 216, 0.25);
  color: #0b1424;
}

@media (min-width: 641px) {
  html.light .sidebar-left, .light .sidebar-left,
  html.light .right-sidebar, .light .right-sidebar {
    background-image: linear-gradient(135deg, #eef2f9 0%, #e4eaf3 100%) !important;
    border-color: #6b7d99 !important;
  }
}

html.light .panel-header, .light .panel-header {
  border-bottom-color: var(--color-border-strong);
}

/* Bug 7 Fix: Global cursor:pointer for interactive elements */
button:not(:disabled),
[role="button"]:not([aria-disabled="true"]),
select,
label[for],
input[type="checkbox"],
input[type="radio"],
input[type="range"],
summary {
  cursor: pointer;
}

/* Hackathon Polish: Additional premium animations */

@keyframes badge-glow-pulse {
  0%, 100% { box-shadow: 0 0 8px currentColor; }
  50%       { box-shadow: 0 0 18px currentColor, 0 0 32px currentColor; }
}
.animate-badge-glow {
  animation: badge-glow-pulse 2s ease-in-out infinite;
}

@keyframes ai-think-bounce {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
  50%       { transform: translateY(-6px) scale(1.1); opacity: 1; }
}
.ai-dot-1 { animation: ai-think-bounce 0.8s ease-in-out infinite 0s; }
.ai-dot-2 { animation: ai-think-bounce 0.8s ease-in-out infinite 0.15s; }
.ai-dot-3 { animation: ai-think-bounce 0.8s ease-in-out infinite 0.30s; }

@keyframes card-entrance {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-card-entrance {
  animation: card-entrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.animate-card-entrance:nth-child(1) { animation-delay: 0.00s; }
.animate-card-entrance:nth-child(2) { animation-delay: 0.05s; }
.animate-card-entrance:nth-child(3) { animation-delay: 0.10s; }
.animate-card-entrance:nth-child(4) { animation-delay: 0.15s; }

@keyframes count-up {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-count {
  animation: count-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes mesh-shift {
  0%   { background-position: 0% 0%; }
  33%  { background-position: 100% 50%; }
  66%  { background-position: 50% 100%; }
  100% { background-position: 0% 0%; }
}
.animate-mesh {
  background-size: 200% 200%;
  animation: mesh-shift 8s ease infinite;
}
`;

const newContent = beforeBlock + newBlock;
fs.writeFileSync('src/styles/global.css', newContent, 'utf8');
const newLines = newContent.split('\n');
console.log('Success! New line count:', newLines.length);
