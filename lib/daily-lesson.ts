import { getSupabaseAdmin } from "@/lib/supabase";

const MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
};

const WEEKDAYS = [
  ["lun", 1],
  ["lundi", 1],
  ["mar", 2],
  ["mardi", 2],
  ["mer", 3],
  ["mercredi", 3],
  ["jeu", 4],
  ["jeudi", 4],
  ["ven", 5],
  ["vendredi", 5],
  ["sam", 6],
  ["samedi", 6],
  ["dim", 0],
  ["dimanche", 0],
] as const;

export interface DailyLesson {
  date: string;
  weekday: string;
  lessonNumber: number;
  lessonTitle: string;
  title: string;
  reference: string;
  body: string;
  essential: string;
  prayer: string;
  annualReading: string;
  sourceUpdatedAt: string | null;
}

interface DaySection {
  date: Date;
  weekday: string;
  title: string;
  text: string;
}

function normalizeLine(line: string): string {
  return line.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function cleanText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !/^\d{1,3}$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseDate(day: string, month: string, year: number): Date | null {
  const monthIndex = MONTHS[month.toLowerCase().replace(/\.$/, "")];
  if (monthIndex === undefined) return null;
  const date = new Date(Date.UTC(year, monthIndex, Number(day), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateForTimezone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), 12));
}

function mondayOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function sundayOfWeek(date: Date): Date {
  const result = mondayOfWeek(date);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

function isInWeek(date: Date, sunday: Date): boolean {
  return date >= mondayOfWeek(sunday) && date <= sundayOfWeek(sunday);
}

function dayHeader(line: string, defaultYear: number) {
  const normalized = normalizeLine(line).replace(/\s+/g, " ");
  const weekday = WEEKDAYS.find(([label]) =>
    new RegExp(`^${label}\\.?\\s`, "i").test(normalized)
  );
  if (!weekday) return null;

  const match = normalized.match(
    /^(?:Lun|Lundi|Mar|Mardi|Mer|Mercredi|Jeu|Jeudi|Ven|Vendredi|Sam|Samedi|Dim|Dimanche)\.?\s*(\d{1,2})\s*([A-ZÀ-Ÿa-zà-ÿ]+)\.?\s*(\d{4})?\s*:\s*(.*)$/i
  );
  if (!match) return null;
  const date = parseDate(match[1], match[2], match[3] ? Number(match[3]) : defaultYear);
  if (!date) return null;
  return { date, weekday: normalized.split(/[ .:]/)[0], title: match[4].trim() };
}

function findLessonTitle(header: string[], lessonNumber: number): string {
  const marker = header.findIndex((line) => /CANTIQUES\s+SUGGERES/i.test(line));
  if (marker > 0) {
    const candidates = header
      .slice(Math.max(0, marker - 5), marker)
      .filter((line) => !/^(THEME|TRIMESTRIEL|UNITÉ|UNITE|LEÇON|DIMANCHE|MOIS|LA THÉOLOGIE)/i.test(line))
      .sort((a, b) => b.length - a.length);
    if (candidates[0]) return candidates[0];
  }
  return header.find((line) => /^[A-ZÀ-Ÿ][A-ZÀ-Ÿ'’ -]{12,}$/.test(line)) ?? `Leçon ${lessonNumber}`;
}

function findLessonBlock(sourceText: string, targetDate: Date, lessonStart: number): { number: number; title: string; raw: string; sunday: Date } | null {
  const text = sourceText.replace(/\r/g, "");
  const marker = /(?:^|\n)\s*Leçon\s*:\s*(\d+)\b/gi;
  const matches = [...text.matchAll(marker)];

  for (let index = 0; index < matches.length; index += 1) {
    const number = Number(matches[index][1]);
    if (number < lessonStart) continue;
    const start = matches[index].index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const raw = text.slice(start, end);
    const header = raw.slice(0, 2600);
    const sundayMatch = header.match(/DIMANCHE\s+(\d{1,2})\s+([A-ZÀ-Ÿa-zà-ÿ]+)\.?\s+(\d{4})/i);
    if (!sundayMatch) continue;
    const sunday = parseDate(sundayMatch[1], sundayMatch[2], Number(sundayMatch[3]));
    if (!sunday || !isInWeek(targetDate, sunday)) continue;
    return {
      number,
      title: findLessonTitle(header.split("\n").map(normalizeLine).filter(Boolean), number),
      raw,
      sunday,
    };
  }
  return null;
}

function findDaySections(block: { raw: string; sunday: Date }): DaySection[] {
  const lines = block.raw.split("\n");
  const starts: Array<{ line: number; header: NonNullable<ReturnType<typeof dayHeader>> }> = [];
  lines.forEach((line, index) => {
    const header = dayHeader(line, block.sunday.getUTCFullYear());
    if (header) starts.push({ line: index, header });
  });

  return starts.map((entry, index) => {
    const nextStart = starts[index + 1]?.line ?? lines.length;
    const end = lines.slice(entry.line, nextStart).findIndex((line) =>
      /^(INTRIGUE DU TEXTE DE REFERENCE|LES GRANDES ARTICULATIONS DU TEXTE DE REFERENCE|EVALUATION FORMATIVE|CONCLUSION)$/i.test(normalizeLine(line))
    );
    const endLine = end >= 0 ? entry.line + end : nextStart;
    const rawLines = lines.slice(entry.line, endLine);
    let title = entry.header.title;
    for (let i = 1; i <= 3 && i < rawLines.length; i += 1) {
      const continuation = normalizeLine(rawLines[i]);
      if (!continuation) continue;
      const openParenthesis = (title.match(/\(/g) ?? []).length > (title.match(/\)/g) ?? []).length;
      const endsWithReference = /[-–—:]\s*$/.test(title);
      if (!openParenthesis && !endsWithReference) break;
      title = `${title} ${continuation}`.replace(/\s+([),.:;])/g, "$1").replace(/-\s+(?=\d)/g, "-");
      if ((title.match(/\(/g) ?? []).length <= (title.match(/\)/g) ?? []).length) break;
    }
    return { date: entry.header.date, weekday: entry.header.weekday, title, text: cleanText(rawLines.join("\n")) };
  });
}

function valueBetween(text: string, start: RegExp, end: RegExp): string {
  const match = text.match(new RegExp(`${start.source}([\\s\\S]*?)(?=${end.source}|$)`, "i"));
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function getLocalLessonDate(timeZone = "Africa/Porto-Novo"): string {
  return dateKey(dateForTimezone(timeZone));
}

export function extractDailyLesson(
  sourceText: string,
  requestedDate: string,
  lessonStart = 1,
  sourceUpdatedAt: string | null = null
): DailyLesson | null {
  const targetDate = new Date(`${requestedDate}T12:00:00Z`);
  if (Number.isNaN(targetDate.getTime())) return null;
  const block = findLessonBlock(sourceText, targetDate, lessonStart);
  if (!block) return null;
  const section = findDaySections(block).find((item) => dateKey(item.date) === requestedDate);
  if (!section) return null;

  const sectionLines = section.text.split("\n");
  const titleLine = sectionLines.shift() ?? section.title;
  let titleIsOpen = (titleLine.match(/\(/g) ?? []).length > (titleLine.match(/\)/g) ?? []).length;
  while (titleIsOpen && sectionLines.length > 0) {
    const continuation = sectionLines.shift() ?? "";
    titleIsOpen = (continuation.match(/\(/g) ?? []).length > (continuation.match(/\)/g) ?? []).length;
  }
  const content = sectionLines.join("\n").trim();
  const essential = valueBetween(content, /Point Essentiel\s*:/i, /Axe de prière\s*:/i);
  const prayer = valueBetween(content, /Axe de prière\s*:/i, /Lire la Bible en entier en un an\s*:/i);
  const annualReading = compact(content.match(/Lire la Bible en entier en un an\s*:\s*([\s\S]*)$/i)?.[1] ?? "");
  const body = compact(
    content
      .replace(/Point Essentiel\s*:[\s\S]*?(?=Axe de prière\s*:|$)/i, "")
      .replace(/Axe de prière\s*:[\s\S]*?(?=Lire la Bible en entier en un an\s*:|$)/i, "")
      .replace(/Lire la Bible en entier en un an\s*:[\s\S]*$/i, "")
  );
  const reference = section.title.match(/\(([^()]+)\)\s*$/)?.[1]?.trim() ?? "";

  return {
    date: requestedDate,
    weekday: section.weekday,
    lessonNumber: block.number,
    lessonTitle: block.title,
    title: section.title,
    reference,
    body,
    essential: compact(essential),
    prayer: compact(prayer),
    annualReading,
    sourceUpdatedAt,
  };
}

export async function getTodayLesson(): Promise<DailyLesson | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("lesson_sources")
    .select("source_text, lesson_start, updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erreur récupération source de leçon :", error.message);
    return null;
  }
  if (!data?.source_text) return null;
  return extractDailyLesson(
    data.source_text,
    getLocalLessonDate(),
    data.lesson_start ?? 1,
    data.updated_at ?? null
  );
}
