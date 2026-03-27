import { formatDateLong } from '../utils/formatters';
import type { CertificateData } from './Certificate';

export function generateCertificateId(worldId: string, displayName: string, completedAt: string): string {
  const raw = `${worldId}-${displayName}-${completedAt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `AA-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

const CERT_WIDTH = 800;
const CERT_HEIGHT = 560;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadCertificateSVG(data: CertificateData): void {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  const certId = data.certificateId || generateCertificateId(data.worldId, data.displayName, data.completedAt);
  const isMaster = data.isMaster ?? false;
  const dateStr = formatDateLong(data.completedAt);
  const worldLabel = isMaster ? 'FULL CURRICULUM MASTERY' : `World ${data.worldSortOrder}: ${data.worldName}`.toUpperCase();
  const iconContent = isMaster && data.allWorldIcons
    ? data.allWorldIcons.join('  ')
    : data.worldIcon;

  const corners = [[24, 24], [CERT_WIDTH - 36, 24], [24, CERT_HEIGHT - 36], [CERT_WIDTH - 36, CERT_HEIGHT - 36]];
  const cornersSvg = corners.map(([cx, cy]) =>
    `<g><rect x="${cx}" y="${cy}" width="12" height="12" fill="#6B4FBB"/><rect x="${cx! + 3}" y="${cy! + 3}" width="6" height="6" fill="#FFD700"/></g>`
  ).join('');

  const stats = [
    { label: 'LESSONS', value: String(data.lessonsCompleted), x: CERT_WIDTH / 2 - 180 },
    { label: 'XP EARNED', value: data.xpEarned.toLocaleString(), x: CERT_WIDTH / 2 },
    { label: 'QUIZZES', value: String(data.quizzesPassed), x: CERT_WIDTH / 2 + 180 },
  ];
  const statsSvg = stats.map(s =>
    `<g><text x="${s.x}" y="370" text-anchor="middle" fill="#FFD700" font-size="14">${s.value}</text><text x="${s.x}" y="388" text-anchor="middle" fill="#9B93B0" font-size="6" letter-spacing="1">${s.label}</text></g>`
  ).join('');

  const iconY = isMaster ? 170 : 168;
  const iconFontSize = isMaster ? 20 : 28;

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CERT_WIDTH} ${CERT_HEIGHT}" width="${CERT_WIDTH}" height="${CERT_HEIGHT}" style="font-family: monospace">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#551CA9"/><stop offset="50%" stop-color="#6B4FBB"/><stop offset="100%" stop-color="#9185D1"/></linearGradient>
    <linearGradient id="gd" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#B8860B"/><stop offset="50%" stop-color="#FFD700"/><stop offset="100%" stop-color="#B8860B"/></linearGradient>
    <radialGradient id="sl" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFD700"/><stop offset="70%" stop-color="#DAA520"/><stop offset="100%" stop-color="#B8860B"/></radialGradient>
  </defs>
  <rect width="${CERT_WIDTH}" height="${CERT_HEIGHT}" fill="#0D0B1A" rx="4"/>
  <rect x="4" y="4" width="${CERT_WIDTH - 8}" height="${CERT_HEIGHT - 8}" fill="none" stroke="url(#bg)" stroke-width="6" rx="2"/>
  <rect x="16" y="16" width="${CERT_WIDTH - 32}" height="${CERT_HEIGHT - 32}" fill="none" stroke="#2B1260" stroke-width="2" rx="2" stroke-dasharray="8 4"/>
  ${cornersSvg}
  <text x="${CERT_WIDTH / 2}" y="70" text-anchor="middle" fill="url(#gd)" font-size="18" letter-spacing="4">ASPIRE LEARN</text>
  <line x1="150" y1="88" x2="${CERT_WIDTH - 150}" y2="88" stroke="#6B4FBB" stroke-width="2"/>
  <text x="${CERT_WIDTH / 2}" y="120" text-anchor="middle" fill="#C7CFF1" font-size="12" letter-spacing="2">${isMaster ? 'MASTER CERTIFICATE' : 'CERTIFICATE OF COMPLETION'}</text>
  <text x="${CERT_WIDTH / 2}" y="${iconY}" text-anchor="middle" font-size="${iconFontSize}" fill="white">${iconContent}</text>
  <text x="${CERT_WIDTH / 2}" y="${isMaster ? 200 : 198}" text-anchor="middle" fill="#FFD700" font-size="11" letter-spacing="1">${worldLabel}</text>
  <text x="${CERT_WIDTH / 2}" y="240" text-anchor="middle" fill="#9B93B0" font-size="8" letter-spacing="2">AWARDED TO</text>
  <text x="${CERT_WIDTH / 2}" y="275" text-anchor="middle" fill="white" font-size="16" letter-spacing="1">${escapeXml(data.displayName)}</text>
  <line x1="200" y1="290" x2="${CERT_WIDTH - 200}" y2="290" stroke="#6B4FBB" stroke-width="1"/>
  <text x="${CERT_WIDTH / 2}" y="320" text-anchor="middle" fill="#9B93B0" font-size="8">${dateStr}</text>
  ${statsSvg}
  <circle cx="${CERT_WIDTH / 2}" cy="445" r="32" fill="url(#sl)"/>
  <circle cx="${CERT_WIDTH / 2}" cy="445" r="28" fill="none" stroke="#0D0B1A" stroke-width="2"/>
  <circle cx="${CERT_WIDTH / 2}" cy="445" r="24" fill="none" stroke="#B8860B" stroke-width="1"/>
  <text x="${CERT_WIDTH / 2}" y="442" text-anchor="middle" fill="#0D0B1A" font-size="7" font-weight="bold">ASPIRE</text>
  <text x="${CERT_WIDTH / 2}" y="454" text-anchor="middle" fill="#0D0B1A" font-size="5">LEARN</text>
  <text x="${CERT_WIDTH / 2}" y="${CERT_HEIGHT - 28}" text-anchor="middle" fill="#4A4560" font-size="6">Certificate ID: ${certId}</text>
</svg>`;

  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = isMaster ? 'aspire-learn-master-certificate.svg' : `aspire-learn-${data.worldId}-certificate.svg`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  document.body.removeChild(container);
}

export function copyCertificateSummary(data: CertificateData): void {
  const isMaster = data.isMaster ?? false;
  const lines = [
    `🏆 Aspire Learn — ${isMaster ? 'Master Certificate' : 'Certificate of Completion'}`,
    '',
    isMaster ? 'Full Curriculum Mastery' : `${data.worldIcon} World ${data.worldSortOrder}: ${data.worldName}`,
    `Awarded to: ${data.displayName}`,
    `Date: ${formatDateLong(data.completedAt)}`,
    '',
    `${data.lessonsCompleted} Lessons | ${data.xpEarned.toLocaleString()} XP | ${data.quizzesPassed} Quizzes`,
    '',
    `Certificate ID: ${data.certificateId}`,
    '',
    'aspirelearn.dev',
  ];
  navigator.clipboard.writeText(lines.join('\n'));
}
