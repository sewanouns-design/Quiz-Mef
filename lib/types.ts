export type QuestionType = "mcq" | "true_false" | "short" | "fill_blank" | "open";

export type QuizMode = "overview" | "sequential";

export interface DailyQuiz {
  id: string;
  title: string;
  lesson_date: string;
  is_active: boolean;
  duration_seconds: number | null;
  quiz_mode: QuizMode;
  created_at: string;
}

export interface DailyQuestion {
  id: string;
  quiz_id: string;
  type: QuestionType;
  question: string;
  options: string[] | null;
  correct_option: number | null;
  correct_text: string | null;
  justification: string | null;
  points: number;
  position: number;
}

/** Question sans les champs de correction, envoyée au participant avant soumission. */
export type PublicQuestion = Omit<
  DailyQuestion,
  "correct_option" | "correct_text" | "justification"
>;

export interface Participant {
  id: string;
  name: string;
  address: string;
  email: string | null;
  whatsapp: string | null;
  device_key: string;
  created_at: string;
}

export interface DailySubmission {
  id: string;
  quiz_id: string;
  participant_id: string;
  score: number;
  max_score: number;
  cancelled: boolean;
  cancel_reason: string | null;
  attempt_number: number;
  open_score: number | null;
  result_token: string;
  normalized_name: string;
  submitted_at: string;
}

export interface LessonQuestion {
  id: string;
  quiz_id: string;
  participant_id: string;
  question_text: string;
  created_at: string;
}

export interface DailyAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  selected_option: number | null;
  answer_text: string | null;
  is_correct: boolean | null;
  points_awarded: number | null;
}

/** Format d'entrée pour une réponse envoyée par le participant lors de la soumission. */
export interface AnswerInput {
  questionId: string;
  selectedOption?: number;
  answerText?: string;
}

/** Format JSON importé par l'admin pour créer/modifier les questions d'un quiz. */
export interface QuestionImport {
  /** Présent uniquement en édition : préserve l'identité de la question pour
   * que les réponses déjà enregistrées restent rattachées lors d'un recalcul. */
  id?: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctOption?: number;
  correctText?: string;
  justification?: string;
  points: number;
}

export type HomeTemplate = "steps" | "minimal" | "card";

export interface HomeStep {
  icon: string;
  title: string;
  description: string;
}

export interface SiteSettings {
  id: string;
  template: HomeTemplate;
  color_primary: string;
  color_primary_light: string;
  color_primary_dark: string;
  color_accent: string;
  color_accent_light: string;
  color_accent_dark: string;
  color_secondary: string;
  color_secondary_light: string;
  color_secondary_dark: string;
  color_background: string;
  color_text: string;
  font_family: string;
  logo_icon: string;
  hero_title: string;
  hero_subtitle: string;
  steps: HomeStep[];
  verse_text: string;
  verse_reference: string;
  footer_text: string;
  show_stats: boolean;
  updated_at: string;
}

export interface CorrectedAnswer {
  questionId: string;
  question: string;
  type: QuestionType;
  options: string[] | null;
  participantSelectedOption: number | null;
  participantAnswerText: string | null;
  correctOption: number | null;
  correctText: string | null;
  justification: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
  points: number;
}
