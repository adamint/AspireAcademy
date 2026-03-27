import { useRef } from 'react';
import { Box } from '@chakra-ui/react';
import { formatDateLong } from '../utils/formatters';
import { generateCertificateId } from './certificateUtils';

export interface CertificateData {
  worldId: string;
  worldName: string;
  worldIcon: string;
  worldSortOrder: number;
  displayName: string;
  completedAt: string;
  lessonsCompleted: number;
  xpEarned: number;
  quizzesPassed: number;
  certificateId: string;
  isMaster?: boolean;
  allWorldIcons?: string[];
}

interface CertificateProps {
  data: CertificateData;
  compact?: boolean;
}

const CERT_WIDTH = 800;
const CERT_HEIGHT = 560;

function CertificateSVG({ data }: { data: CertificateData }) {
  const certId = data.certificateId || generateCertificateId(data.worldId, data.displayName, data.completedAt);
  const isMaster = data.isMaster ?? false;
  const borderGradId = `grad-${data.worldId}`;
  const goldGradId = `gold-${data.worldId}`;
  const sealGradId = `seal-${data.worldId}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${CERT_WIDTH} ${CERT_HEIGHT}`}
      width="100%"
      height="100%"
      className="cert-svg"
      role="img"
      aria-label={`Certificate of completion for ${data.worldName} world, awarded to ${data.displayName}`}
    >
      <defs>
        <linearGradient id={borderGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#551CA9" />
          <stop offset="50%" stopColor="#6B4FBB" />
          <stop offset="100%" stopColor="#9185D1" />
        </linearGradient>
        <linearGradient id={goldGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#B8860B" />
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#B8860B" />
        </linearGradient>
        <radialGradient id={sealGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="70%" stopColor="#DAA520" />
          <stop offset="100%" stopColor="#B8860B" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width={CERT_WIDTH} height={CERT_HEIGHT} fill="#0D0B1A" rx="4" />

      {/* Purple gradient border */}
      <rect
        x="4" y="4"
        width={CERT_WIDTH - 8} height={CERT_HEIGHT - 8}
        fill="none"
        stroke={`url(#${borderGradId})`}
        strokeWidth="6"
        rx="2"
      />

      {/* Inner decorative border */}
      <rect
        x="16" y="16"
        width={CERT_WIDTH - 32} height={CERT_HEIGHT - 32}
        fill="none"
        stroke="#2B1260"
        strokeWidth="2"
        rx="2"
        strokeDasharray="8 4"
      />

      {/* Pixel-art corner decorations */}
      {[[24, 24], [CERT_WIDTH - 36, 24], [24, CERT_HEIGHT - 36], [CERT_WIDTH - 36, CERT_HEIGHT - 36]].map(([cx, cy], i) => (
        <g key={i}>
          <rect x={cx} y={cy} width="12" height="12" fill="#6B4FBB" />
          <rect x={cx + 3} y={cy + 3} width="6" height="6" fill="#FFD700" />
        </g>
      ))}

      {/* Header: ASPIRE LEARN */}
      <text
        x={CERT_WIDTH / 2} y="70"
        textAnchor="middle"
        fill={`url(#${goldGradId})`}
        fontSize="18"
        letterSpacing="4"
      >
        ASPIRE LEARN
      </text>

      {/* Decorative line */}
      <line x1="150" y1="88" x2={CERT_WIDTH - 150} y2="88" stroke="#6B4FBB" strokeWidth="2" />

      {/* Certificate of Completion */}
      <text
        x={CERT_WIDTH / 2} y="120"
        textAnchor="middle"
        fill="#C7CFF1"
        fontSize="12"
        letterSpacing="2"
      >
        {isMaster ? 'MASTER CERTIFICATE' : 'CERTIFICATE OF COMPLETION'}
      </text>

      {/* World icon and name */}
      {isMaster && data.allWorldIcons ? (
        <>
          <text
            x={CERT_WIDTH / 2} y="170"
            textAnchor="middle"
            fontSize="20"
            fill="white"
          >
            {data.allWorldIcons.join('  ')}
          </text>
          <text
            x={CERT_WIDTH / 2} y="200"
            textAnchor="middle"
            fill="#FFD700"
            fontSize="11"
            letterSpacing="1"
          >
            FULL CURRICULUM MASTERY
          </text>
        </>
      ) : (
        <>
          <text
            x={CERT_WIDTH / 2} y="168"
            textAnchor="middle"
            fontSize="28"
            fill="white"
          >
            {data.worldIcon}
          </text>
          <text
            x={CERT_WIDTH / 2} y="198"
            textAnchor="middle"
            fill="#FFD700"
            fontSize="11"
            letterSpacing="1"
          >
            {`World ${data.worldSortOrder}: ${data.worldName}`.toUpperCase()}
          </text>
        </>
      )}

      {/* Awarded to */}
      <text
        x={CERT_WIDTH / 2} y="240"
        textAnchor="middle"
        fill="#9B93B0"
        fontSize="8"
        letterSpacing="2"
      >
        AWARDED TO
      </text>

      {/* User display name */}
      <text
        x={CERT_WIDTH / 2} y="275"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        letterSpacing="1"
      >
        {data.displayName}
      </text>

      {/* Decorative line under name */}
      <line x1="200" y1="290" x2={CERT_WIDTH - 200} y2="290" stroke="#6B4FBB" strokeWidth="1" />

      {/* Completion date */}
      <text
        x={CERT_WIDTH / 2} y="320"
        textAnchor="middle"
        fill="#9B93B0"
        fontSize="8"
      >
        {formatDateLong(data.completedAt)}
      </text>

      {/* Stats row */}
      {[
        { label: 'LESSONS', value: String(data.lessonsCompleted), x: CERT_WIDTH / 2 - 180 },
        { label: 'XP EARNED', value: data.xpEarned.toLocaleString(), x: CERT_WIDTH / 2 },
        { label: 'QUIZZES', value: String(data.quizzesPassed), x: CERT_WIDTH / 2 + 180 },
      ].map((stat) => (
        <g key={stat.label}>
          <text
            x={stat.x} y="370"
            textAnchor="middle"
            fill="#FFD700"
            fontSize="14"
          >
            {stat.value}
          </text>
          <text
            x={stat.x} y="388"
            textAnchor="middle"
            fill="#9B93B0"
            fontSize="6"
            letterSpacing="1"
          >
            {stat.label}
          </text>
        </g>
      ))}

      {/* Seal */}
      <circle cx={CERT_WIDTH / 2} cy="445" r="32" fill={`url(#${sealGradId})`} />
      <circle cx={CERT_WIDTH / 2} cy="445" r="28" fill="none" stroke="#0D0B1A" strokeWidth="2" />
      <circle cx={CERT_WIDTH / 2} cy="445" r="24" fill="none" stroke="#B8860B" strokeWidth="1" />
      <text
        x={CERT_WIDTH / 2} y="442"
        textAnchor="middle"
        fill="#0D0B1A"
        fontSize="7"
        fontWeight="bold"
      >
        ASPIRE
      </text>
      <text
        x={CERT_WIDTH / 2} y="454"
        textAnchor="middle"
        fill="#0D0B1A"
        fontSize="5"
      >
        LEARN
      </text>

      {/* Certificate ID */}
      <text
        x={CERT_WIDTH / 2} y={CERT_HEIGHT - 28}
        textAnchor="middle"
        fill="#4A4560"
        fontSize="6"
      >
        Certificate ID: {certId}
      </text>
    </svg>
  );
}

export function Certificate({ data, compact }: CertificateProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (compact) {
    return (
      <Box w="100%" css={{ aspectRatio: `${CERT_WIDTH}/${CERT_HEIGHT}` }}>
        <CertificateSVG data={data} />
      </Box>
    );
  }

  return (
    <Box ref={containerRef} w="100%" maxW="800px" mx="auto">
      <Box css={{ aspectRatio: `${CERT_WIDTH}/${CERT_HEIGHT}` }}>
        <CertificateSVG data={data} />
      </Box>
    </Box>
  );
}
