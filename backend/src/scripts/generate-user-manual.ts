/**
 * Builds the BDBBC ERP user manual as a PDF.
 *
 *   npx ts-node src/scripts/generate-user-manual.ts
 *
 * Bangla is the primary language, so the Windows Bangla font (Nirmala UI) is
 * embedded — pdfmake's bundled Roboto has no Bengali glyphs and would print
 * empty boxes. Output: docs/BDBBC-ERP-User-Manual.pdf
 */
import * as fs from 'fs';
import * as path from 'path';
import PdfPrinter from 'pdfmake';
import { PARTS, MANUAL_VERSION, type Block, type Chapter } from './user-manual-content';

const FONT_DIR = 'C:/Windows/Fonts';
const OUT = path.resolve(__dirname, '../../../docs/BDBBC-ERP-User-Manual.pdf');

const FONTS = {
  Body: {
    normal: `${FONT_DIR}/Nirmala.ttf`,
    bold: `${FONT_DIR}/NirmalaB.ttf`,
    italics: `${FONT_DIR}/Nirmala.ttf`,
    bolditalics: `${FONT_DIR}/NirmalaB.ttf`,
  },
};

const C = {
  ink: '#0f172a',
  muted: '#475569',
  faint: '#94a3b8',
  accent: '#1d4ed8',
  accentSoft: '#eff6ff',
  rule: '#e2e8f0',
  warnSoft: '#fffbeb',
  warnLine: '#f59e0b',
  headBg: '#1e293b',
};

/** One Bangla line, with the English gloss smaller and lighter beneath it. */
const line = (bn: string, en?: string, opts: { bullet?: boolean } = {}) => ({
  ...(opts.bullet ? { ul: undefined } : {}),
  stack: [
    { text: bn, fontSize: 9.5, color: C.ink, lineHeight: 1.35 },
    ...(en ? [{ text: en, fontSize: 7.5, color: C.faint, lineHeight: 1.25, margin: [0, 1, 0, 0] as [number, number, number, number] }] : []),
  ],
});

const blockToContent = (block: Block): any[] => {
  switch (block.kind) {
    case 'para':
      return [line(block.bn, block.en), { text: '', margin: [0, 0, 0, 6] as [number, number, number, number] }];

    case 'sub':
      return [
        {
          stack: [
            { text: block.bn, fontSize: 10.5, bold: true, color: C.accent },
            ...(block.en ? [{ text: block.en, fontSize: 7.5, color: C.faint }] : []),
          ],
          margin: [0, 10, 0, 4] as [number, number, number, number],
        },
      ];

    case 'note':
      return [
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { text: 'মনে রাখবেন', fontSize: 8, bold: true, color: '#b45309' },
                    { text: block.bn, fontSize: 9, color: '#78350f', margin: [0, 2, 0, 0] as [number, number, number, number] },
                    ...(block.en ? [{ text: block.en, fontSize: 7.5, color: '#a16207', margin: [0, 1, 0, 0] as [number, number, number, number] }] : []),
                  ],
                },
              ],
            ],
          },
          layout: {
            fillColor: () => C.warnSoft,
            hLineColor: () => C.warnLine,
            vLineColor: () => C.warnLine,
            hLineWidth: () => 0.6,
            vLineWidth: (i: number) => (i === 0 || i === 1 ? 2 : 0),
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
          margin: [0, 8, 0, 8] as [number, number, number, number],
        },
      ];

    case 'steps':
      return [
        {
          ol: block.items.map((item) => line(item.bn, item.en)),
          olMargin: [14, 2, 0, 6],
          separator: { text: '', margin: [0, 2, 0, 2] as [number, number, number, number] },
        },
        { text: '', margin: [0, 0, 0, 4] as [number, number, number, number] },
      ];

    case 'bullets':
      return [
        {
          ul: block.items.map((item) => line(item.bn, item.en)),
          ulMargin: [10, 2, 0, 6],
          separator: { text: '', margin: [0, 2, 0, 2] as [number, number, number, number] },
        },
        { text: '', margin: [0, 0, 0, 4] as [number, number, number, number] },
      ];

    case 'table':
      return [
        {
          table: {
            headerRows: 1,
            widths: block.head.length === 2 ? ['38%', '*'] : new Array(block.head.length).fill('*'),
            body: [
              block.head.map((h) => ({ text: h, fontSize: 8.5, bold: true, color: '#ffffff', fillColor: C.headBg, margin: [2, 3, 2, 3] as [number, number, number, number] })),
              ...block.rows.map((row) =>
                row.map((cell) => ({ text: cell, fontSize: 8.2, color: C.ink, margin: [2, 3, 2, 3] as [number, number, number, number] }))
              ),
            ],
          },
          layout: {
            hLineColor: () => C.rule,
            vLineColor: () => C.rule,
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
          margin: [0, 6, 0, 10] as [number, number, number, number],
        },
      ];
  }
};

const chapterContent = (chapter: Chapter, index: number): any[] => [
  {
    stack: [
      { text: chapter.titleBn, fontSize: 14, bold: true, color: C.ink },
      { text: chapter.titleEn, fontSize: 8.5, color: C.faint },
    ],
    margin: [0, index === 0 ? 0 : 6, 0, 6] as [number, number, number, number],
  },
  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: C.accent }], margin: [0, 0, 0, 10] as [number, number, number, number] },
  ...chapter.blocks.flatMap(blockToContent),
];

/* ── Cover ─────────────────────────────────────────────────────────────── */
const cover = [
  { text: '', margin: [0, 60, 0, 0] as [number, number, number, number] },
  { text: 'BDBBC ERP Solution', fontSize: 30, bold: true, color: C.accent, alignment: 'center' as const },
  { text: 'ইউজার ম্যানুয়াল · User Manual', fontSize: 18, bold: true, color: C.ink, alignment: 'center' as const, margin: [0, 6, 0, 0] as [number, number, number, number] },
  {
    text: 'নতুন ব্যবহারকারী ও সুপার অ্যাডমিনের জন্য ধাপে ধাপে নির্দেশিকা\nStep-by-step guide for shop staff and the super admin',
    fontSize: 11,
    color: C.muted,
    alignment: 'center' as const,
    lineHeight: 1.5,
    margin: [0, 12, 0, 0] as [number, number, number, number],
  },
  { canvas: [{ type: 'line', x1: 120, y1: 0, x2: 395, y2: 0, lineWidth: 1.5, lineColor: C.rule }], margin: [0, 24, 0, 24] as [number, number, number, number] },
  {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: 'এই ম্যানুয়ালে যা আছে', fontSize: 11, bold: true, color: C.ink, alignment: 'center' as const },
              { text: 'অংশ ক — শুরু করার আগে · লগইন · ভাষা ও প্রতিষ্ঠান · কে কী করতে পারে', fontSize: 9, color: C.muted, alignment: 'center' as const, margin: [0, 6, 0, 2] as [number, number, number, number] },
              { text: 'অংশ খ — দৈনিক কাজ: শিফট, POS বিক্রয়, ফেরত, গ্রাহক, পণ্য, ক্রয়, স্টক, হিসাব, রিপোর্ট', fontSize: 9, color: C.muted, alignment: 'center' as const, margin: [0, 2, 0, 2] as [number, number, number, number] },
              { text: 'অংশ গ — সুপার অ্যাডমিন: প্রতিষ্ঠান, ব্যবহারকারী, রোল, সেটিংস, ব্যাকআপ, অডিট', fontSize: 9, color: C.muted, alignment: 'center' as const, margin: [0, 2, 0, 2] as [number, number, number, number] },
              { text: 'অংশ ঘ — সমস্যা ও সমাধান · স্ট্যাটাস · অনুমতির তালিকা', fontSize: 9, color: C.muted, alignment: 'center' as const, margin: [0, 2, 0, 0] as [number, number, number, number] },
            ],
          },
        ],
      ],
    },
    layout: {
      fillColor: () => '#f8fafc',
      hLineColor: () => C.rule,
      vLineColor: () => C.rule,
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: () => 10,
      paddingBottom: () => 10,
    },
    margin: [30, 0, 30, 0] as [number, number, number, number],
  },
  { text: '', margin: [0, 40, 0, 0] as [number, number, number, number] },
  {
    text: `সংস্করণ / Version: ${MANUAL_VERSION}     ·     তারিখ / Date: ${new Date().toLocaleDateString('en-GB')}`,
    fontSize: 9,
    color: C.muted,
    alignment: 'center' as const,
  },
  {
    text: 'Software by BDBBC · এই ম্যানুয়ালটি সফটওয়্যারের বর্তমান সংস্করণ অনুযায়ী লেখা',
    fontSize: 8,
    color: C.faint,
    alignment: 'center' as const,
    margin: [0, 4, 0, 0] as [number, number, number, number],
  },
];

/* ── Contents ──────────────────────────────────────────────────────────── */
const contents = [
  { text: 'সূচিপত্র · Contents', fontSize: 18, bold: true, color: C.ink, margin: [0, 0, 0, 12] as [number, number, number, number] },
  ...PARTS.flatMap((part) => [
    { text: part.titleBn, fontSize: 12, bold: true, color: C.accent, margin: [0, 12, 0, 2] as [number, number, number, number] },
    { text: part.titleEn, fontSize: 8, color: C.faint, margin: [0, 0, 0, 6] as [number, number, number, number] },
    ...part.chapters.map((chapter) => ({
      stack: [
        { text: chapter.titleBn, fontSize: 9.5, color: C.ink },
        { text: chapter.titleEn, fontSize: 7.5, color: C.faint },
      ],
      margin: [12, 0, 0, 5] as [number, number, number, number],
    })),
  ]),
];

/* ── Body ──────────────────────────────────────────────────────────────── */
const body = PARTS.flatMap((part, partIndex) => [
  {
    stack: [
      { text: part.titleBn, fontSize: 22, bold: true, color: C.accent },
      { text: part.titleEn, fontSize: 11, color: C.muted, margin: [0, 4, 0, 0] as [number, number, number, number] },
      { text: part.summaryBn, fontSize: 9.5, color: C.ink, margin: [0, 10, 0, 0] as [number, number, number, number], lineHeight: 1.4 },
    ],
    pageBreak: partIndex === 0 ? undefined : 'before',
    margin: [0, 0, 0, 18] as [number, number, number, number],
  },
  ...part.chapters.flatMap((chapter, chapterIndex) => [
    ...(chapterIndex === 0 ? [] : [{ text: '', pageBreak: 'before' }]),
    ...chapterContent(chapter, chapterIndex),
  ]),
]);

const docDefinition: any = {
  pageSize: 'A4',
  pageMargins: [46, 54, 46, 56],
  defaultStyle: { font: 'Body', fontSize: 9.5, color: C.ink },
  info: {
    title: 'BDBBC ERP Solution — User Manual (Bangla / English)',
    author: 'BDBBC',
    subject: 'POS & ERP user manual for shop staff and super admins',
  },
  content: [...cover, { text: '', pageBreak: 'after' }, ...contents, { text: '', pageBreak: 'after' }, ...body],
  footer: (currentPage: number, pageCount: number) => ({
    columns: [
      { text: 'BDBBC ERP Solution — ইউজার ম্যানুয়াল', fontSize: 7.5, color: C.faint, margin: [46, 0, 0, 0] },
      { text: `পৃষ্ঠা ${currentPage} / ${pageCount}`, fontSize: 7.5, color: C.faint, alignment: 'right' as const, margin: [0, 0, 46, 0] },
    ],
    margin: [0, 20, 0, 0] as [number, number, number, number],
  }),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const printer = new PdfPrinter(FONTS as any);
const pdfDoc = printer.createPdfKitDocument(docDefinition);
const stream = fs.createWriteStream(OUT);

pdfDoc.pipe(stream);
pdfDoc.end();

stream.on('finish', () => {
  const pages = PARTS.reduce((sum, p) => sum + p.chapters.length, 0);
  console.log(`✅ manual written: ${OUT}`);
  console.log(`   ${PARTS.length} parts · ${pages} chapters · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
});
