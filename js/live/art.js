const icons = {
  pulse: '<path d="M3 11 12 3l9 8v10h-6v-7H9v7H3z"/>',
  parlor: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/>',
  kin: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m1-17a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 6"/>',
  gatherings:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
};
export const icon = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${icons[k] || icons.pulse}</svg>`;
export const brand = `<svg viewBox="0 0 34 40" fill="none" aria-hidden="true"><path d="M4 36V17L17 5l13 12v19H4Z" stroke="currentColor" stroke-width="1.6"/><path d="M13 31c-6-5 5-8 3-15 10 9 8 15 2 17-3 1-6-1-5-2Z" fill="#a77350"/></svg>`;
export const sprig = `<svg class="sprig" viewBox="0 0 100 140" fill="none" aria-hidden="true"><path d="M48 142Q30 80 65 15" stroke="#748162" stroke-width="2"/><path d="M43 113Q-3 101 13 74q31 0 30 39M44 86Q73 95 87 61 52 59 44 86M49 62Q17 49 31 27q28 7 18 35M57 42Q87 38 84 8 57 14 57 42" fill="#a6b38c"/></svg>`;
