#!/usr/bin/env node

/**
 * Extrait le texte strictement nécessaire à la génération d'un quiz MEF.
 *
 * Usage :
 *   node scripts/extract-active-lesson.mjs --pdf ./livret.pdf --date 2026-10-13 --scope daily
 *   node scripts/extract-active-lesson.mjs --text-file ./source.txt --date 2026-10-13 --scope daily
 *   node scripts/extract-active-lesson.mjs --pdf ./livret.pdf --date 2026-10-18 --scope weekly
 *   node scripts/extract-active-lesson.mjs --pdf ./livret.pdf --lesson 7 --scope all
 *
 * Le script utilise pdftotext (présent dans l'environnement d'automatisation).
 * Il ne transmet jamais le livret complet : la sortie contient uniquement la
 * leçon correspondant à la date, la journée demandée et/ou les articulations.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MONTHS = {
  jan: 0,
  janv: 0,
  janvier: 0,
  fev: 1,
  févr: 1,
  fevr: 1,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  avr: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  juil: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  sept: 8,
  sep: 8,
  oct: 9,
  octobre: 9,
  novembre: 10,
  nov: 10,
  decembre: 11,
  décembre: 11,
  dec: 11,
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
];

function fail(message) {
  console.error(`extract-active-lesson: ${message}`);
  process.exit(1);
}

function argsFrom(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function normalizeLine(line) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const PRAYER_MARKER = /(?:Axe|Astre)\s*(?:de\s*)?prière\s*:/i;
const ESSENTIAL_MARKER = /Point\s+Essentiel\s*:/i;
const ANNUAL_MARKER = /Lire\s+la\s+Bible(?:\s+en\s+entier)?\s+en\s+un\s+an\s*:/i;

function isPdfNoiseLine(line) {
  return (
    /^SEPTEMBRE\s*[-–—]\s*NOVEMBRE\s+2026$/i.test(line) ||
    /^LA TH[ÉE]OLOGIE DU DUR LABEUR$/i.test(line) ||
    /^(?:ADULTES|ADOLESCENTS|ENFANTS)$/i.test(line) ||
    /^Disponible dans les bureaux Mission Evangélique de la Foi/i.test(line) ||
    /^\d{2,3}\s+BP\s+\d+/i.test(line) ||
    /^(?:T[ée]l(?:\/Fax)?|Email)\b/i.test(line) ||
    /^Page\s*\d+$/i.test(line) ||
    /^\d{1,3}$/.test(line)
  );
}

function cleanText(value) {
  return value
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter((line) => line && !isPdfNoiseLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeAnnualReading(value) {
  return value
    .split("\n")
    .filter((line) => !ANNUAL_MARKER.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractDailyParts(value) {
  const text = removeAnnualReading(value);
  const essentialMatch = text.match(new RegExp(`${ESSENTIAL_MARKER.source}([\\s\\S]*?)(?=${PRAYER_MARKER.source}|$)`, "i"));
  const prayerMatch = text.match(new RegExp(`${PRAYER_MARKER.source}([\\s\\S]*?)$`, "i"));
  const essential = essentialMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const prayer = prayerMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const body = text
    .replace(new RegExp(`${ESSENTIAL_MARKER.source}[\\s\\S]*?(?=${PRAYER_MARKER.source}|$)`, "i"), "")
    .replace(new RegExp(`${PRAYER_MARKER.source}[\\s\\S]*$`, "i"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, body, essential, prayer };
}

function parseDate(day, month, year) {
  const monthIndex = MONTHS[month.toLowerCase()];
  if (monthIndex === undefined) return null;
  const date = new Date(Date.UTC(Number(year), monthIndex, Number(day), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseInputDate(value) {
  if (!value) return new Date();
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) fail(`date invalide « ${value} » (format attendu : YYYY-MM-DD)`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (Number.isNaN(date.getTime())) fail(`date invalide « ${value} »`);
  return date;
}

function mondayOfWeek(date) {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setUTCDate(result.getUTCDate() + diff);
  return result;
}

function sundayOfWeek(date) {
  const result = mondayOfWeek(date);
  result.setUTCDate(result.getUTCDate() + 6);
  return result;
}

function dateInWeek(date, weekSunday) {
  const monday = mondayOfWeek(weekSunday);
  const sunday = sundayOfWeek(weekSunday);
  return date >= monday && date <= sunday;
}

function readSource({ pdfPath, textFile }) {
  if (textFile) {
    if (!existsSync(textFile)) fail(`fichier texte introuvable : ${textFile}`);
    return readFileSync(textFile, "utf8");
  }
  if (!pdfPath) fail("indique --pdf ou --text-file");
  if (!existsSync(pdfPath)) fail(`PDF introuvable : ${pdfPath}`);
  try {
    return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`impossible d'extraire le texte du PDF : ${detail}`);
  }
}

function findLessonBlocks(rawText) {
  const text = rawText.replace(/\r/g, "");
  const marker = /(?:^|\n)\s*Leçon\s*:\s*(\d+)\b/gi;
  const matches = [...text.matchAll(marker)];
  const blocks = [];

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const rawBlock = text.slice(start, end);
    const header = rawBlock.slice(0, Math.min(rawBlock.length, 2400));
    const sundayMatch = header.match(
      /DIMANCHE\s+(\d{1,2})\s+([A-ZÀ-Ÿa-zà-ÿ]+)\.?\s+(\d{4})/i
    );
    if (!sundayMatch) continue;
    const sunday = parseDate(sundayMatch[1], sundayMatch[2].replace(/\.$/, ""), sundayMatch[3]);
    if (!sunday) continue;

    const headerLines = header.split("\n").map(normalizeLine).filter(Boolean);
    const titleLineIndex = headerLines.findIndex((line) => /CANTIQUES\s+SUGGERES/i.test(line));
    let lessonTitle = "";
    if (titleLineIndex > 0) {
      const candidates = headerLines.slice(Math.max(0, titleLineIndex - 5), titleLineIndex);
      lessonTitle = candidates
        .filter((line) => !/^(THEME|TRIMESTRIEL|UNITÉ|UNITE|Leçon|DIMANCHE|MOIS|LA THÉOLOGIE)/i.test(line))
        .sort((a, b) => b.length - a.length)[0] ?? "";
    }
    if (!lessonTitle) {
      const fallback = headerLines.find((line) => /^[A-ZÀ-Ÿ][A-ZÀ-Ÿ'’ -]{12,}$/.test(line));
      lessonTitle = fallback ?? `Leçon ${matches[index][1]}`;
    }

    // Le titre général est parfois placé juste avant « Leçon : » dans le PDF,
    // donc en dehors de rawBlock. Exemple :
    // « THEME TRIMESTRIEL: » puis « CRÉÉ POUR ÊTRE SAGES ET PRUDENTS ».
    // Sans ce rattrapage, le découpage de « 7ème » pouvait devenir le faux titre
    // « ème », ce qui produisait un mauvais sous-titre dans les quiz automatiques.
    const precedingLines = text
      .slice(Math.max(0, start - 700), start)
      .split("\n")
      .map(normalizeLine)
      .filter(Boolean);
    for (let priorIndex = precedingLines.length - 1; priorIndex >= 0; priorIndex -= 1) {
      if (!/^TRIMESTRIEL\s*:?$/i.test(precedingLines[priorIndex]) && !/^THEME\s+TRIMESTRIEL\s*:?$/i.test(precedingLines[priorIndex])) continue;
      const candidate = precedingLines[priorIndex + 1] ?? "";
      if (
        candidate &&
        candidate.length >= 8 &&
        !/^Leçon|^DIMANCHE|^MOIS|^CANTIQUES|^UNIT[ÉE]/i.test(candidate) &&
        !/^\d/.test(candidate)
      ) {
        lessonTitle = candidate;
      }
      break;
    }

    blocks.push({
      lessonNumber: Number(matches[index][1]),
      sunday,
      weekStart: mondayOfWeek(sunday),
      weekEnd: sundayOfWeek(sunday),
      lessonTitle,
      rawText: rawBlock,
      start,
      end,
    });
  }
  return blocks;
}

function findDayHeader(line, defaultYear) {
  const normalized = normalizeLine(line).replace(/\s+/g, " ");
  const weekday = WEEKDAYS.find(([label]) => new RegExp(`^${label}\\.?\\s`, "i").test(normalized));
  if (!weekday) return null;
  const match = normalized.match(
    /^(?:Lun|Lundi|Mar|Mardi|Mer|Mercredi|Jeu|Jeudi|Ven|Vendredi|Sam|Samedi|Dim|Dimanche)\.?\s*(\d{1,2})\s*([A-ZÀ-Ÿa-zà-ÿ]+)\.?\s*(\d{4})?\s*:\s*(.+)$/i
  );
  if (!match) return { weekday: weekday[1], label: normalized, date: null, title: normalized };
  const year = match[3] ? Number(match[3]) : defaultYear;
  const title = match[4].trim();
  return {
    weekday: weekday[1],
    label: normalized,
    date: year ? parseDate(match[1], match[2].replace(/\.$/, ""), year) : null,
    title,
  };
}

function findDaySections(block) {
  const lines = block.rawText.split("\n");
  const sections = [];
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeLine(lines[index]);
    if (!normalized) continue;
    const header = findDayHeader(normalized, block.sunday.getUTCFullYear());
    if (header && header.date) {
      // Dans le PDF, une référence peut être coupée juste après le deux-points
      // ou le tiret final (ex. « Proverbes 6:12- » puis « 19) » à la ligne suivante).
      // Réunir uniquement cette continuation de titre, jamais le début du texte.
      let title = header.title;
      for (let nextIndex = index + 1; nextIndex < lines.length && nextIndex <= index + 3; nextIndex += 1) {
        const continuation = normalizeLine(lines[nextIndex]);
        if (!continuation) continue;
        if (findDayHeader(continuation, block.sunday.getUTCFullYear())?.date) break;
        if (/^(INTRIGUE DU TEXTE DE REFERENCE|LES GRANDES ARTICULATIONS DU TEXTE DE REFERENCE|EVALUATION FORMATIVE|CONCLUSION)$/i.test(continuation)) break;
        const hasOpenParenthesis = (title.match(/\(/g) ?? []).length > (title.match(/\)/g) ?? []).length;
        const looksLikeReferenceContinuation = hasOpenParenthesis || /[-–—:]\s*$/.test(title);
        if (!looksLikeReferenceContinuation) break;
        title = `${title} ${continuation}`
          .replace(/\s+([),.:;])/g, "$1")
          .replace(/-\s+(?=\d)/g, "-");
        if ((title.match(/\(/g) ?? []).length <= (title.match(/\)/g) ?? []).length) break;
      }
      if (current) current.endLine = index;
      current = {
        ...header,
        title,
        startLine: index,
        endLine: lines.length,
      };
      sections.push(current);
    }
    if (/^(INTRIGUE DU TEXTE DE REFERENCE|LES GRANDES ARTICULATIONS DU TEXTE DE REFERENCE|EVALUATION FORMATIVE|CONCLUSION)$/i.test(normalized)) {
      if (current) current.endLine = index;
      current = null;
    }
  }

  return sections.map((section) => ({
    ...section,
    text: cleanText(lines.slice(section.startLine, section.endLine).join("\n")),
  }));
}

function extractArticulations(block) {
  const match = block.rawText.match(
    /LES GRANDES ARTICULATIONS DU TEXTE DE REFERENCE([\s\S]*?)(?=\n\s*(?:EVALUATION FORMATIVE|CONCLUSION)\b)/i
  );
  return match ? cleanText(match[1]) : "";
}

function extractReference(block) {
  const match = block.rawText.match(/TEXTES DE REFERENCE\s*([\s\S]{0,900}?)(?:Verset à mémoriser|LECTURES BIBLIQUES)/i);
  return match ? cleanText(match[1]).replace(/\s+/g, " ").trim() : "";
}

function chooseBlock(blocks, date, lessonNumber) {
  if (lessonNumber !== undefined) {
    const match = blocks.find((block) => block.lessonNumber === Number(lessonNumber));
    if (!match) fail(`leçon ${lessonNumber} introuvable dans le PDF`);
    return match;
  }
  const match = blocks.find((block) => dateInWeek(date, block.sunday));
  if (!match) {
    fail(`aucune leçon ne couvre la date ${formatDate(date)} ; indique --lesson pour forcer une leçon`);
  }
  return match;
}

function main() {
  const args = argsFrom(process.argv);
  if (args.help || (!args.pdf && !args["text-file"])) {
    console.log("Usage: node scripts/extract-active-lesson.mjs --pdf <fichier.pdf> | --text-file <fichier.txt> [--date YYYY-MM-DD] [--lesson N] [--scope daily|weekly|all]");
    process.exit(args.help ? 0 : 1);
  }

  const scope = args.scope ?? "daily";
  if (!["daily", "weekly", "all"].includes(scope)) fail(`scope invalide « ${scope} »`);

  const targetDate = parseInputDate(args.date);
  const pdfPath = args.pdf ? resolve(String(args.pdf)) : null;
  const textFile = args["text-file"] ? resolve(String(args["text-file"])) : null;
  const blocks = findLessonBlocks(readSource({ pdfPath, textFile }));
  if (blocks.length === 0) fail("aucun bloc de leçon exploitable n'a été trouvé");

  const block = chooseBlock(blocks, targetDate, args.lesson);
  const sections = findDaySections(block);
  const activeDay = sections.find((section) => section.date && formatDate(section.date) === formatDate(targetDate)) ?? null;
  const articulations = extractArticulations(block);
  const lessonText = removeAnnualReading(cleanText(block.rawText));
  const dailyParts = activeDay ? extractDailyParts(activeDay.text) : null;

  if (scope === "daily" && !activeDay) {
    fail(`aucune lecture quotidienne ne correspond à ${formatDate(targetDate)} dans la leçon ${block.lessonNumber}`);
  }
  if ((scope === "weekly" || scope === "all") && !articulations) {
    fail(`section des articulations introuvable dans la leçon ${block.lessonNumber}`);
  }

  const output = {
    extractedAt: new Date().toISOString(),
    source: {
      file: pdfPath ?? textFile,
      extraction: pdfPath ? "pdftotext -layout" : "stored-text",
    },
    lesson: {
      number: block.lessonNumber,
      title: block.lessonTitle,
      reference: extractReference(block),
      weekStart: formatDate(block.weekStart),
      weekEnd: formatDate(block.weekEnd),
    },
    requested: {
      date: formatDate(targetDate),
      scope,
    },
    daily: activeDay
      ? {
          date: formatDate(activeDay.date),
          weekday: activeDay.weekday,
          title: activeDay.title,
          text: dailyParts.text,
          body: dailyParts.body,
          essential: dailyParts.essential,
          prayer: dailyParts.prayer,
        }
      : null,
    articulations: scope === "daily" ? null : articulations,
    lessonText: scope === "all" ? lessonText : undefined,
    availableDays: sections.map((section) => ({
      date: section.date ? formatDate(section.date) : null,
      weekday: section.weekday,
      title: section.title,
    })),
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
