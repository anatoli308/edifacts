import { NextResponse } from 'next/server';

function detectMessageType(edifactText) {
  if (!edifactText) return null;
  // Try to detect via UNH segment: UNH+...:ORDERS:D:96A:...
  const unhMatch = edifactText.match(/UNH[^\n\r]*:(?<type>[A-Z0-9]+):/i);
  if (unhMatch && unhMatch.groups?.type) {
    return unhMatch.groups.type.toUpperCase();
  }
  // Fallback: look for BGM doc type (not reliable for message type)
  const bgmMatch = edifactText.match(/BGM\+(?<docType>[0-9]{3})/i);
  if (bgmMatch && bgmMatch.groups?.docType) {
    return `BGM-${bgmMatch.groups.docType}`;
  }
  return null;
}

function getSubsetLabel(subset) {
  if (!subset) return null;
  const MAP = {
    'ansi-asc-x12': 'ANSI ASC X12',
    'eancom': 'EANCOM',
    'hipaa': 'HIPAA',
    'odette': 'ODETTE Automotive',
    'oracle-gateway': 'Oracle-Gateway',
    'rosettanet': 'RosettaNet',
    'sap': 'SAP',
    'swift': 'SWIFT',
    'tradacoms': 'TRADACOMS',
    'un-edifact': 'UN/EDIFACT',
    'vda': 'VDA',
    'vics': 'VICS',
  };
  return MAP[subset] ?? subset;
}

export async function POST(req) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ ok: false, error: 'Content-Type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const subset = formData.get('subset') || null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'Missing file field' }, { status: 400 });
    }

    // Basic validation on filename/size
    const name = file.name || 'upload.edi';
    const size = file.size ?? 0;
    const allowedExt = ['.edi', '.edifact', '.txt'];
    const hasAllowedExt = allowedExt.some((ext) => name.toLowerCase().endsWith(ext));
    if (!hasAllowedExt) {
      return NextResponse.json({ ok: false, error: 'Unsupported file type. Allowed: .edi, .edifact, .txt' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const messageType = detectMessageType(text);

    // Placeholder: Here you would parse into canonical JSON tree.
    // For now, return basic metadata + preview. UI can display in tabs.
    const response = {
      ok: true,
      subset: subset ? { value: subset, label: getSubsetLabel(subset) } : null,
      file: { name, size },
      detected: { messageType },
      stats: { bytes: text.length, lines: lines.length },
      views: {
        segments: { ready: false, note: 'Segment Tree view TBD' },
        business: { ready: false, note: 'Business view TBD' },
        jsonXml: { ready: false, note: 'JSON/XML view TBD' },
        rules: { ready: false, note: 'Rule Editor view TBD' },
      },
      preview: text.slice(0, 4000),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('Visualization upload error:', err);
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Visualization upload endpoint' });
}
