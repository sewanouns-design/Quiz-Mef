#!/usr/bin/env node

/**
 * Validation pré-publication des quiz générés automatiquement.
 * Usage : node scripts/validate-quiz-generation.mjs --file /tmp/quiz.json --category daily
 */
import { existsSync, readFileSync } from "node:fs";

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

function normalize(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value) {
  return normalize(value).split(" ").filter((word) => word.length >= 3);
}

function isAdvancedTrueFalse(options) {
  return (
    options.length === 4 &&
    options.every((option) => /^(vrai|faux)\s*,?\s+car\b/i.test(String(option).trim()))
  );
}

function fail(message) {
  console.error(JSON.stringify({ valid: false, errors: [message] }, null, 2));
  process.exit(1);
}

const args = argsFrom(process.argv);
const file = String(args.file ?? "");
if (!file || !existsSync(file)) fail(`fichier JSON introuvable : ${file}`);

let payload;
try {
  payload = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  fail(`JSON invalide : ${error instanceof Error ? error.message : String(error)}`);
}

const category = String(args.category ?? payload?.metadata?.category ?? "daily");
const metadata = payload?.metadata;
const questions = payload?.questions;
const errors = [];
const warnings = [];

if (!metadata || typeof metadata !== "object") errors.push("metadata est obligatoire.");
if (!Array.isArray(questions)) errors.push("questions doit être un tableau.");

if (metadata && typeof metadata === "object") {
  const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
  const subtitle = typeof metadata.subtitle === "string" ? metadata.subtitle.trim() : "";
  if (!title) errors.push("metadata.title est obligatoire.");
  if (!subtitle) warnings.push("metadata.subtitle est vide.");
  if (/[\-–—:(]$|\.\.\.$/.test(title)) {
    errors.push(`titre possiblement tronqué : « ${title} »`);
  }
  if (category === "daily" && !/\([^()]+\)$/.test(title)) {
    errors.push("un quiz quotidien doit avoir une référence complète entre parenthèses dans son titre.");
  }
  if (category === "daily" || category === "weekly") {
    if (metadata.durationSeconds !== (category === "daily" ? 240 : 900)) {
      errors.push(`durée incorrecte pour ${category} : ${metadata.durationSeconds}`);
    }
  }
}

if (Array.isArray(questions)) {
  const expectedCount = category === "weekly" ? 20 : category === "daily" ? [5, 6] : 20;
  if (Array.isArray(expectedCount)) {
    if (!expectedCount.includes(questions.length)) errors.push(`un quiz daily doit avoir 5 ou 6 questions, reçu ${questions.length}.`);
  } else if (questions.length !== expectedCount) {
    errors.push(`le quiz ${category} doit avoir ${expectedCount} questions, reçu ${questions.length}.`);
  }

  let total = 0;
  const correctOptionIndexes = [];
  let advancedTrueFalseCount = 0;
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const prefix = `question ${index + 1}`;
    if (!question || typeof question !== "object") {
      errors.push(`${prefix} invalide.`);
      continue;
    }
    total += typeof question.points === "number" ? question.points : 0;
    if (question.type !== "mcq") errors.push(`${prefix} : le type doit être mcq.`);
    const options = Array.isArray(question.options) ? question.options : [];
    const expectedOptions = category === "quarterly" ? 5 : 4;
    if (options.length !== expectedOptions) errors.push(`${prefix} : ${expectedOptions} options attendues, reçu ${options.length}.`);
    const isAffirmationQuestion = category !== "quarterly" && isAdvancedTrueFalse(options);
    if (isAffirmationQuestion) advancedTrueFalseCount += 1;
    if (category !== "quarterly" && options.length === 4 && !isAffirmationQuestion) {
      const verdictOptions = options.filter((option) => /^(vrai|faux)\b/i.test(String(option).trim()));
      if (verdictOptions.length > 0 && verdictOptions.length < 4) {
        errors.push(`${prefix} : une question Vrai/Faux doit avoir 4 propositions complètes commençant par « Vrai, car » ou « Faux, car ».`);
      }
    }
    if (typeof question.correctOption !== "number" || question.correctOption < 0 || question.correctOption >= options.length) {
      errors.push(`${prefix} : correctOption invalide.`);
    } else if (category !== "quarterly") {
      correctOptionIndexes.push(question.correctOption);
    }
    if (!question.justification || typeof question.justification !== "string") errors.push(`${prefix} : justification obligatoire.`);

    const normalizedOptions = options.map(normalize);
    if (new Set(normalizedOptions).size !== normalizedOptions.length) errors.push(`${prefix} : options dupliquées.`);
    if (category !== "quarterly" && normalizedOptions.some((option) =>
      option.includes("toutes les propositions") || option.includes("aucune des propositions")
    )) {
      errors.push(`${prefix} : les options « toutes »/« aucune » sont interdites pour ${category}.`);
    }

    const lengths = options.map((option) => words(option).length).filter(Boolean);
    if (lengths.length === options.length && lengths.length > 1) {
      const min = Math.min(...lengths);
      const max = Math.max(...lengths);
      if (min > 0 && max / min > 2.5) warnings.push(`${prefix} : longueur des options très déséquilibrée (${min}–${max} mots).`);
      const correctLength = words(options[question.correctOption] ?? "").length;
      const median = [...lengths].sort((a, b) => a - b)[Math.floor(lengths.length / 2)];
      if (median > 0 && correctLength > median * 1.8) errors.push(`${prefix} : la bonne réponse est anormalement plus longue que les distracteurs.`);
    }

    const tokenSets = options.map((option) => new Set(words(option)));
    const sharedCounts = tokenSets.map((set, optionIndex) => {
      let shared = 0;
      for (let other = 0; other < tokenSets.length; other += 1) {
        if (other === optionIndex) continue;
        for (const token of set) if (tokenSets[other].has(token)) shared += 1;
      }
      return shared;
    });
    if (sharedCounts.length === 4 && sharedCounts.filter((count) => count === 0).length >= 3) {
      warnings.push(`${prefix} : les options partagent très peu de vocabulaire ; vérifier manuellement leur proximité.`);
    }
  }
  if (total !== 20) errors.push(`total de points incorrect : ${total}, attendu 20.`);
  if (category === "daily" && questions.length >= 5 && advancedTrueFalseCount < 3) {
    errors.push(`un quiz quotidien doit contenir au moins 3 questions Vrai/Faux avancées (trouvées : ${advancedTrueFalseCount}).`);
  }
  if (category === "weekly" && advancedTrueFalseCount < 8) {
    errors.push(`un quiz hebdomadaire doit contenir au moins 8 questions Vrai/Faux avancées (trouvées : ${advancedTrueFalseCount}).`);
  }
  if (category !== "quarterly" && correctOptionIndexes.length === questions.length) {
    const counts = [0, 0, 0, 0];
    for (const optionIndex of correctOptionIndexes) counts[optionIndex] += 1;
    const distinctIndexes = counts.filter((count) => count > 0).length;
    const maximumRepetition = Math.max(...counts);
    if (distinctIndexes < Math.min(3, questions.length)) {
      errors.push("les bonnes réponses ne sont pas suffisamment réparties entre A, B, C et D.");
    }
    if (maximumRepetition > Math.ceil(questions.length / 2)) {
      errors.push("un même indice de réponse est utilisé trop souvent ; cela rend le quiz devinable.");
    }
  }
}

const result = { valid: errors.length === 0, errors, warnings };
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) process.exit(1);
