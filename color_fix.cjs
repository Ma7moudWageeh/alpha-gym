const fs = require('fs');
const path = require('path');

function fixColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace text-black with text-white on dark buttons
  content = content.replace(/bg-\[\#181E2A\] hover:bg-slate-600 text-black/g, 'bg-[#181E2A] hover:bg-slate-600 text-white');
  content = content.replace(/bg-\[\#181E2A\] hover:bg-slate-600 border border-slate-600 text-black/g, 'bg-[#181E2A] hover:bg-slate-600 border border-slate-600 text-white');
  content = content.replace(/bg-\[\#121721\] hover:bg-\[\#181E2A\] border border-\[\#222B3D\] text-black/g, 'bg-[#121721] hover:bg-[#181E2A] border border-[#222B3D] text-white');
  content = content.replace(/text-black hover:text-white/g, 'text-white hover:text-slate-200'); // Just in case
  content = content.replace(/bg-\[\#181E2A\] hover:bg-slate-600 text-black/g, 'bg-[#181E2A] hover:bg-slate-600 text-white');

  fs.writeFileSync(filePath, content, 'utf8');
}

const pagesDir = path.join(__dirname, 'src', 'pages');

['Dashboard.jsx', 'Clients.jsx', 'ClientProfile.jsx', 'Reports.jsx', 'Settings.jsx', 'Login.jsx', 'SetupWizard.jsx'].forEach(f => {
  const p = path.join(pagesDir, f);
  if(fs.existsSync(p)) fixColors(p);
});

console.log("Colors fixed!");
