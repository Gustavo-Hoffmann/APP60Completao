import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../contexts/ThemeContext";
import { Routes } from "../../navigation/routes";
import type { Participant } from "../../models/types";

// ====== ADAPTER ======
type Patient = {
  id: string;
  name: string;
  dateOfBirth?: string;
};

function participantToPatient(p: Participant): Patient {
  return {
    id: p.id ?? "",
    name: (p as any).name,
    dateOfBirth: (p as any).dob ?? (p as any).dateOfBirth,
  };
}

type Answers = {
  q1_ageBracket?: "60-74" | "75-84" | "85+";
  q2_health?: "good" | "bad";

  q3_shop?: boolean;
  q4_money?: boolean;
  q5_housework?: boolean;

  q6_bath?: boolean;

  q7_forget?: boolean;
  q8_worse?: boolean;
  q9_impairs?: boolean;

  q10_sad?: boolean;
  q11_noPleasure?: boolean;

  q12_reach?: boolean;
  q13_pinch?: boolean;

  q14_weightLoss?: boolean;
  q14_calfCm?: string;
  q14_walk4mSeconds?: number | null;

  q14_weightKg?: string;
  q14_height?: string;

  q15_walkDifficulty?: boolean;
  q16_falls?: boolean;

  q17_incontinence?: boolean;

  q18_vision?: boolean;
  q19_hearing?: boolean;

  q20_chronic5?: boolean;
  q20_meds5?: boolean;
  q20_hosp6m?: boolean;
  q20_none?: boolean;
};

const parseDOB = (dob?: string) => {
  if (!dob) return null;
  const s = String(dob).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const calcAge = (dob?: string) => {
  const d = parseDOB(dob);
  if (!d) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

const ageToBracketAndScore = (age: number | null) => {
  if (age == null) return { bracket: undefined, score: 0 };
  if (age >= 85) return { bracket: "85+" as const, score: 3 };
  if (age >= 75) return { bracket: "75-84" as const, score: 1 };
  return { bracket: "60-74" as const, score: 0 };
};

const parseNumber = (s?: string) => {
  if (!s) return null;
  const v = Number(String(s).replace(",", ".").trim());
  return Number.isFinite(v) ? v : null;
};

const computeBMI = (answers: Answers) => {
  const weightKg = parseNumber(answers.q14_weightKg);
  const heightRaw = parseNumber(answers.q14_height);

  if (weightKg == null || heightRaw == null) return null;
  if (weightKg <= 0 || heightRaw <= 0) return null;

  const heightM = heightRaw > 3 ? heightRaw / 100 : heightRaw;
  if (!Number.isFinite(heightM) || heightM <= 0) return null;

  const bmi = weightKg / (heightM * heightM);
  return Number.isFinite(bmi) ? bmi : null;
};

const classifyIVCF = (score: number) => {
  if (score <= 6) return { label: "Robusto", key: "robusto" as const };
  if (score <= 14) return { label: "Pré-frágil", key: "prefragil" as const };
  return { label: "Frágil", key: "fragil" as const };
};

const formatSeconds = (sec: number | null | undefined) => {
  if (sec == null || sec <= 0) return "—";
  return `${sec.toFixed(2)} s`;
};

const computeScores = (patient: Patient | null, answers: Answers, walkSecFromTimer: number | null) => {
  const age = calcAge(patient?.dateOfBirth);
  const ageAuto = ageToBracketAndScore(age);

  const ageBracket = (ageAuto as any).bracket ?? answers.q1_ageBracket;
  const ageScore =
    (ageAuto as any).bracket ? (ageAuto as any).score : ageBracket === "85+" ? 3 : ageBracket === "75-84" ? 1 : 0;

  const perceptionScore = answers.q2_health === "bad" ? 1 : 0;

  const avdInstrumentalRaw =
    (answers.q3_shop ? 4 : 0) + (answers.q4_money ? 4 : 0) + (answers.q5_housework ? 4 : 0);
  const avdInstrumentalScore = Math.min(4, avdInstrumentalRaw);

  const avdBasicScore = answers.q6_bath ? 6 : 0;

  const cognitionScore = (answers.q7_forget ? 1 : 0) + (answers.q8_worse ? 1 : 0) + (answers.q9_impairs ? 2 : 0);

  const moodScore = (answers.q10_sad ? 2 : 0) + (answers.q11_noPleasure ? 2 : 0);

  const reachPinchScore = (answers.q12_reach ? 1 : 0) + (answers.q13_pinch ? 1 : 0);

  const bmi = computeBMI(answers);
  const bmiLow = bmi != null ? bmi < 22 : false;

  const calf = parseNumber(answers.q14_calfCm);
  const calfLow = calf != null ? calf < 31 : false;

  const walkSec = walkSecFromTimer ?? answers.q14_walk4mSeconds ?? null;
  const walkSlow = walkSec != null ? walkSec > 5 : false;

  const weightLoss = answers.q14_weightLoss === true;

  const q14Positive = weightLoss || bmiLow || calfLow || walkSlow;
  const q14Score = q14Positive ? 2 : 0;

  const gaitScore = (answers.q15_walkDifficulty ? 2 : 0) + (answers.q16_falls ? 2 : 0);
  const mobilityScore = reachPinchScore + q14Score + gaitScore;

  const continenceScore = answers.q17_incontinence ? 2 : 0;
  const communicationScore = (answers.q18_vision ? 2 : 0) + (answers.q19_hearing ? 2 : 0);

  const comorbidityPositive = !!(answers.q20_chronic5 || answers.q20_meds5 || answers.q20_hosp6m);
  const comorbidityScore = comorbidityPositive ? 4 : 0;

  const blockScores = [
    { key: "idade", label: "Idade", score: ageScore },
    { key: "percepcao", label: "Percepção de saúde", score: perceptionScore },
    { key: "avd_i", label: "AVD instrumental", score: avdInstrumentalScore },
    { key: "avd_b", label: "AVD básica", score: avdBasicScore },
    { key: "cognicao", label: "Cognição", score: cognitionScore },
    { key: "humor", label: "Humor", score: moodScore },
    { key: "mobilidade", label: "Mobilidade", score: mobilityScore },
    { key: "continencia", label: "Continência", score: continenceScore },
    { key: "comunicacao", label: "Comunicação", score: communicationScore },
    { key: "comorbidades", label: "Comorbidade múltipla", score: comorbidityScore },
  ];

  const total = blockScores.reduce((acc, b) => acc + b.score, 0);

  return {
    total,
    blockScores,
    meta: { age, ageBracket, bmi, bmiLow, calf, calfLow, walkSec, walkSlow, q14Positive },
  };
};

const AnswerError = ({ text, styles }: { text: string; styles: any }) => {
  if (!text) return null;
  return <Text style={styles.errorText}>{text}</Text>;
};

const YesNo = ({
  value,
  onChange,
  styles,
  yesLabel = "Sim",
  noLabel = "Não",
}: {
  value: boolean | undefined;
  onChange: (v: boolean) => void;
  styles: any;
  yesLabel?: string;
  noLabel?: string;
}) => {
  return (
    <View style={styles.ynRow}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.ynBtn, value === true && styles.ynBtnActive]}
        onPress={() => onChange(true)}
      >
        <Text style={[styles.ynText, value === true && styles.ynTextActive]}>{yesLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.ynBtn, value === false && styles.ynBtnActive]}
        onPress={() => onChange(false)}
      >
        <Text style={[styles.ynText, value === false && styles.ynTextActive]}>{noLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const Radio = ({
  value,
  options,
  onChange,
  styles,
}: {
  value: string | undefined;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
  styles: any;
}) => {
  return (
    <View style={{ gap: 10 }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            activeOpacity={0.85}
            style={[styles.radioRow, active && styles.radioRowActive]}
            onPress={() => onChange(opt.key)}
          >
            <View style={[styles.dot, active && styles.dotActive]} />
            <Text style={[styles.radioText, active && styles.radioTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const Checkbox = ({
  checked,
  label,
  onToggle,
  disabled,
  styles,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
  styles: any;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.checkRow, disabled && { opacity: 0.5 }]}
      onPress={() => {
        if (!disabled) onToggle();
      }}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkText}>{label}</Text>
    </TouchableOpacity>
  );
};

export function IVCF20Screen({ navigation, route }: any) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const participant = route?.params?.participant as Participant | undefined;
  const participantId: string = route?.params?.participantId ?? participant?.id ?? "";

  const [patient, setPatient] = useState<Patient | null>(participant ? participantToPatient(participant) : null);
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "900" },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.primary]);

  useEffect(() => {
    if (!participant) {
      navigation.replace(Routes.ParticipantPick, {
        nextRoute: Routes.IVCF20,
        testTitle: "IVCF-20",
        testKey: "ivcf20",
      });
    }
  }, [participant, navigation]);

  useEffect(() => {
    if (participant) setPatient(participantToPatient(participant));
  }, [participant]);

  const blocks = useMemo(
    () => [
      { key: "idade", title: "Idade (Q1)" },
      { key: "percepcao", title: "Percepção da saúde (Q2)" },
      { key: "avd_i", title: "AVD Instrumental (Q3–Q5)" },
      { key: "avd_b", title: "AVD Básica (Q6)" },
      { key: "cognicao", title: "Cognição (Q7–Q9)" },
      { key: "humor", title: "Humor (Q10–Q11)" },
      { key: "mobilidade", title: "Mobilidade (Q12–Q16)" },
      { key: "continencia", title: "Continência (Q17)" },
      { key: "comunicacao", title: "Comunicação (Q18–Q19)" },
      { key: "comorbidades", title: "Comorbidade múltipla (Q20)" },
    ],
    []
  );

  const [blockIndex, setBlockIndex] = useState(0);
  const [blockError, setBlockError] = useState<string>("");

  const [walkRunning, setWalkRunning] = useState(false);
  const [walkElapsedMs, setWalkElapsedMs] = useState(0);
  const walkStartRef = useRef<number | null>(null);
  const walkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const age = useMemo(() => calcAge(patient?.dateOfBirth), [patient?.dateOfBirth]);
  const ageAuto = useMemo(() => ageToBracketAndScore(age), [age]);

  useEffect(() => {
    if (!walkRunning) {
      if (walkTimerRef.current) clearInterval(walkTimerRef.current);
      walkTimerRef.current = null;
      return;
    }

    walkStartRef.current = Date.now() - walkElapsedMs;
    walkTimerRef.current = setInterval(() => {
      if (walkStartRef.current == null) return;
      setWalkElapsedMs(Date.now() - walkStartRef.current);
    }, 50);

    return () => {
      if (walkTimerRef.current) clearInterval(walkTimerRef.current);
      walkTimerRef.current = null;
    };
  }, [walkRunning, walkElapsedMs]);

  const walkSeconds = useMemo(() => {
    if (walkElapsedMs <= 0) return null;
    return Number((walkElapsedMs / 1000).toFixed(2));
  }, [walkElapsedMs]);

  useEffect(() => {
    setAnswers((prev) => ({ ...prev, q14_walk4mSeconds: walkSeconds }));
  }, [walkSeconds]);

  const resetWalkTimer = () => {
    setWalkRunning(false);
    setWalkElapsedMs(0);
    walkStartRef.current = null;
    setAnswers((prev) => ({ ...prev, q14_walk4mSeconds: null }));
  };

  const bmi = useMemo(() => computeBMI(answers), [answers]);
  const bmiLow = bmi != null ? bmi < 22 : false;

  const calf = useMemo(() => parseNumber(answers.q14_calfCm), [answers.q14_calfCm]);
  const calfLow = calf != null ? calf < 31 : false;

  const walkSlow = walkSeconds != null ? walkSeconds > 5 : false;

  const validateBlock = (idx: number) => {
    const key = blocks[idx].key;
    setBlockError("");

    const mustBool = (v: boolean | undefined) => typeof v === "boolean";

    if (key === "idade") {
      if ((ageAuto as any).bracket) return true;
      if (!answers.q1_ageBracket) {
        setBlockError("Sem data de nascimento no cadastro. Selecione a faixa etária.");
        return false;
      }
      return true;
    }

    if (key === "percepcao") {
      if (!answers.q2_health) {
        setBlockError("Responda a percepção de saúde.");
        return false;
      }
      return true;
    }

    if (key === "avd_i") {
      if (!mustBool(answers.q3_shop) || !mustBool(answers.q4_money) || !mustBool(answers.q5_housework)) {
        setBlockError("Responda as 3 questões de AVD instrumental.");
        return false;
      }
      return true;
    }

    if (key === "avd_b") {
      if (!mustBool(answers.q6_bath)) {
        setBlockError("Responda a questão da AVD básica.");
        return false;
      }
      return true;
    }

    if (key === "cognicao") {
      if (!mustBool(answers.q7_forget) || !mustBool(answers.q8_worse) || !mustBool(answers.q9_impairs)) {
        setBlockError("Responda as 3 questões de cognição.");
        return false;
      }
      return true;
    }

    if (key === "humor") {
      if (!mustBool(answers.q10_sad) || !mustBool(answers.q11_noPleasure)) {
        setBlockError("Responda as 2 questões de humor.");
        return false;
      }
      return true;
    }

    if (key === "mobilidade") {
      if (!mustBool(answers.q12_reach) || !mustBool(answers.q13_pinch)) {
        setBlockError("Responda alcance/preensão/pinça (Q12–Q13).");
        return false;
      }

      if (!mustBool(answers.q14_weightLoss)) {
        setBlockError("Q14: marque se houve perda de peso (Sim/Não).");
        return false;
      }

      const w = parseNumber(answers.q14_weightKg);
      const h = parseNumber(answers.q14_height);
      if (w == null || h == null || w <= 0 || h <= 0) {
        setBlockError("Q14: informe peso e altura (para calcular o IMC).");
        return false;
      }

      const calfVal = parseNumber(answers.q14_calfCm);
      if (calfVal == null) {
        setBlockError("Q14: informe a circunferência da panturrilha (cm).");
        return false;
      }

      if (walkSeconds == null || walkSeconds <= 0) {
        setBlockError("Q14: faça o teste de marcha 4m (cronômetro obrigatório).");
        return false;
      }

      if (!mustBool(answers.q15_walkDifficulty) || !mustBool(answers.q16_falls)) {
        setBlockError("Responda marcha e quedas (Q15–Q16).");
        return false;
      }

      return true;
    }

    if (key === "continencia") {
      if (!mustBool(answers.q17_incontinence)) {
        setBlockError("Responda a questão de continência.");
        return false;
      }
      return true;
    }

    if (key === "comunicacao") {
      if (!mustBool(answers.q18_vision) || !mustBool(answers.q19_hearing)) {
        setBlockError("Responda visão e audição.");
        return false;
      }
      return true;
    }

    if (key === "comorbidades") {
      const any =
        answers.q20_none === true ||
        answers.q20_chronic5 === true ||
        answers.q20_meds5 === true ||
        answers.q20_hosp6m === true;

      if (!any) {
        setBlockError('Q20: marque ao menos uma opção (ou “Nenhuma”).');
        return false;
      }

      if (answers.q20_none) {
        if (answers.q20_chronic5 || answers.q20_meds5 || answers.q20_hosp6m) {
          setBlockError('Q20: “Nenhuma” não pode coexistir com outras opções.');
          return false;
        }
      }

      return true;
    }

    return true;
  };

  const goNext = () => {
    const ok = validateBlock(blockIndex);
    if (!ok) return;

    if (blocks[blockIndex].key === "mobilidade" && walkRunning) {
      setWalkRunning(false);
    }

    if (blockIndex < blocks.length - 1) {
      setBlockIndex((i) => i + 1);
      setBlockError("");
    } else {
      const scored = computeScores(patient, answers, walkSeconds);
      const cls = classifyIVCF(scored.total);

      navigation.navigate(Routes.IVCF20Result, {
        participant,
        participantId,
        participantName: patient?.name ?? participant?.name ?? "",
        patientId: participantId,
        patientName: patient?.name ?? participant?.name ?? "",
        scoreTotal: scored.total,
        classification: cls,
        blockScores: scored.blockScores,
        answers: { ...answers, q14_walk4mSeconds: walkSeconds },
        meta: scored.meta,
      });
    }
  };

  const goPrev = () => {
    if (blockIndex === 0) return;
    setBlockIndex((i) => i - 1);
    setBlockError("");
  };

  const renderHeader = () => {
    const progress = `${blockIndex + 1}/${blocks.length}`;
    return (
      <View style={styles.hero}>
        <View style={styles.heroPattern} pointerEvents="none">
          <View style={styles.heroRingA} />
          <View style={styles.heroRingB} />
          <View style={styles.heroDiag} />
        </View>

        <View style={styles.heroTopRow}>
          <Text style={styles.heroTitle}>IVCF-20</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{progress}</Text>
          </View>
        </View>

        <Text style={styles.heroSub}>{patient?.name ?? "Participante"}</Text>
        <Text style={styles.heroHint}>{blocks[blockIndex]?.title}</Text>
      </View>
    );
  };

  const renderBlock = () => {
    const key = blocks[blockIndex].key;

    if (key === "idade") {
      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Q1. Idade</Text>

          <View style={{ marginTop: 8 }}>
            <Text style={styles.metaLine}>Nascimento: {patient?.dateOfBirth ?? "—"}</Text>
            <Text style={styles.metaLine}>Idade calculada: {age != null ? `${age} anos` : "—"}</Text>
          </View>

          {(ageAuto as any).bracket ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Faixa automática: {(ageAuto as any).bracket} • Pontos: {(ageAuto as any).score}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.qText}>Sem data de nascimento válida no cadastro. Selecione:</Text>
              <Radio
                styles={styles}
                value={answers.q1_ageBracket}
                options={[
                  { key: "60-74", label: "60 a 74 anos (0)" },
                  { key: "75-84", label: "75 a 84 anos (1)" },
                  { key: "85+", label: "≥ 85 anos (3)" },
                ]}
                onChange={(k) => setAnswers((prev) => ({ ...prev, q1_ageBracket: k as any }))}
              />
            </>
          )}
        </View>
      );
    }

    if (key === "percepcao") {
      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Q2. Percepção da saúde</Text>
          <Text style={styles.qText}>
            Em geral, comparando com outras pessoas de sua idade, você diria que sua saúde é:
          </Text>

          <Radio
            styles={styles}
            value={answers.q2_health}
            options={[
              { key: "good", label: "Excelente, muito boa ou boa (0)" },
              { key: "bad", label: "Regular ou ruim (1)" },
            ]}
            onChange={(k) => setAnswers((prev) => ({ ...prev, q2_health: k as any }))}
          />
        </View>
      );
    }

    if (key === "avd_i") {
      const q = (label: string, v: boolean | undefined, onChange: (b: boolean) => void) => (
        <View style={styles.qBox}>
          <Text style={styles.qText}>{label}</Text>
          <YesNo styles={styles} value={v} onChange={onChange} />
        </View>
      );

      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>AVD Instrumental (Q3–Q5)</Text>
          <Text style={styles.hintText}>Observação: este bloco tem pontuação máxima de 4 pontos.</Text>

          {q("Q3. Por causa de sua saúde ou condição física, você deixou de fazer compras?", answers.q3_shop, (b) =>
            setAnswers((prev) => ({ ...prev, q3_shop: b }))
          )}

          {q(
            "Q4. Por causa de sua saúde ou condição física, você deixou de controlar seu dinheiro, gasto ou pagar as contas de sua casa?",
            answers.q4_money,
            (b) => setAnswers((prev) => ({ ...prev, q4_money: b }))
          )}

          {q(
            "Q5. Por causa de sua saúde ou condição física, você deixou de realizar pequenos trabalhos domésticos (lavar louça, arrumar a casa ou limpeza leve)?",
            answers.q5_housework,
            (b) => setAnswers((prev) => ({ ...prev, q5_housework: b }))
          )}
        </View>
      );
    }

    if (key === "avd_b") {
      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>AVD Básica (Q6)</Text>
          <View style={styles.qBox}>
            <Text style={styles.qText}>Q6. Por causa de sua saúde ou condição física, você deixou de tomar banho sozinho?</Text>
            <YesNo styles={styles} value={answers.q6_bath} onChange={(b) => setAnswers((prev) => ({ ...prev, q6_bath: b }))} />
          </View>
        </View>
      );
    }

    if (key === "cognicao") {
      const q = (label: string, v: boolean | undefined, onChange: (b: boolean) => void) => (
        <View style={styles.qBox}>
          <Text style={styles.qText}>{label}</Text>
          <YesNo styles={styles} value={v} onChange={onChange} />
        </View>
      );

      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Cognição (Q7–Q9)</Text>

          {q("Q7. Algum familiar ou amigo falou que você está ficando esquecido?", answers.q7_forget, (b) =>
            setAnswers((prev) => ({ ...prev, q7_forget: b }))
          )}

          {q("Q8. Este esquecimento está piorando nos últimos meses?", answers.q8_worse, (b) =>
            setAnswers((prev) => ({ ...prev, q8_worse: b }))
          )}

          {q("Q9. Este esquecimento está impedindo a realização de alguma atividade do cotidiano?", answers.q9_impairs, (b) =>
            setAnswers((prev) => ({ ...prev, q9_impairs: b }))
          )}
        </View>
      );
    }

    if (key === "humor") {
      const q = (label: string, v: boolean | undefined, onChange: (b: boolean) => void) => (
        <View style={styles.qBox}>
          <Text style={styles.qText}>{label}</Text>
          <YesNo styles={styles} value={v} onChange={onChange} />
        </View>
      );

      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Humor (Q10–Q11)</Text>

          {q("Q10. No último mês, você ficou com desânimo, tristeza ou desesperança?", answers.q10_sad, (b) =>
            setAnswers((prev) => ({ ...prev, q10_sad: b }))
          )}

          {q("Q11. No último mês, você perdeu o interesse ou prazer em atividades anteriormente prazerosas?", answers.q11_noPleasure, (b) =>
            setAnswers((prev) => ({ ...prev, q11_noPleasure: b }))
          )}
        </View>
      );
    }

    if (key === "mobilidade") {
      const q = (label: string, v: boolean | undefined, onChange: (b: boolean) => void) => (
        <View style={styles.qBox}>
          <Text style={styles.qText}>{label}</Text>
          <YesNo styles={styles} value={v} onChange={onChange} />
        </View>
      );

      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Mobilidade (Q12–Q16)</Text>
          <Text style={styles.hintText}>Observação: a Q14 pontua no máximo 2 pontos (mesmo com vários critérios positivos).</Text>

          {q("Q12. Você é incapaz de elevar os braços acima do nível do ombro?", answers.q12_reach, (b) =>
            setAnswers((prev) => ({ ...prev, q12_reach: b }))
          )}

          {q("Q13. Você é incapaz de manusear ou segurar pequenos objetos?", answers.q13_pinch, (b) =>
            setAnswers((prev) => ({ ...prev, q13_pinch: b }))
          )}

          <View style={styles.divider} />

          <Text style={styles.subBlockTitle}>Q14. Capacidade aeróbica e/ou muscular</Text>

          <View style={styles.qBox}>
            <Text style={styles.qText}>Houve perda de peso não intencional?</Text>
            <Text style={styles.smallHint}>4,5kg ou 5% no último ano, ou 6kg nos últimos 6 meses, ou 3kg no último mês.</Text>
            <YesNo styles={styles} value={answers.q14_weightLoss} onChange={(b) => setAnswers((prev) => ({ ...prev, q14_weightLoss: b }))} />
          </View>

          <View style={styles.qBox}>
            <Text style={styles.qText}>IMC &lt; 22 kg/m²</Text>
            <View style={styles.inlineInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Peso (kg)</Text>
                <TextInput
                  value={answers.q14_weightKg ?? ""}
                  onChangeText={(t) => setAnswers((prev) => ({ ...prev, q14_weightKg: t }))}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  placeholder="ex: 70"
                  placeholderTextColor={theme.colors.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Altura (cm ou m)</Text>
                <TextInput
                  value={answers.q14_height ?? ""}
                  onChangeText={(t) => setAnswers((prev) => ({ ...prev, q14_height: t }))}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  placeholder="ex: 170 ou 1,70"
                  placeholderTextColor={theme.colors.muted}
                />
              </View>
            </View>
            <Text style={styles.infoLine}>
              IMC: {bmi != null ? bmi.toFixed(1) : "—"} • Critério IMC&lt;22: {bmi != null ? (bmiLow ? "SIM" : "NÃO") : "—"}
            </Text>
          </View>

          <View style={styles.qBox}>
            <Text style={styles.qText}>Circunferência da panturrilha (cm)</Text>
            <TextInput
              value={answers.q14_calfCm ?? ""}
              onChangeText={(t) => setAnswers((prev) => ({ ...prev, q14_calfCm: t }))}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="ex: 30,5"
              placeholderTextColor={theme.colors.muted}
            />
            <Text style={styles.infoLine}>Critério &lt; 31 cm: {calfLow ? "SIM" : calf != null ? "NÃO" : "—"}</Text>
          </View>

          <View style={styles.qBox}>
            <Text style={styles.qText}>Marcha (4m) — cronômetro obrigatório</Text>
            <Text style={styles.smallHint}>Critério positivo se tempo &gt; 5 segundos.</Text>

            <Text style={styles.timer}>{formatSeconds(walkSeconds)}</Text>
            <Text style={styles.infoLine}>Critério &gt; 5s: {walkSlow ? "SIM" : walkSeconds != null ? "NÃO" : "—"}</Text>

            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, walkRunning ? styles.btnStop : styles.btnStart]} onPress={() => setWalkRunning((v) => !v)}>
                <Text style={styles.btnText}>{walkRunning ? "Parar" : "Iniciar"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={resetWalkTimer}>
                <Text style={[styles.btnText, styles.btnGhostText]}>Refazer</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {q("Q15. Você tem dificuldade para caminhar capaz de impedir a realização de alguma atividade do cotidiano?", answers.q15_walkDifficulty, (b) =>
            setAnswers((prev) => ({ ...prev, q15_walkDifficulty: b }))
          )}

          {q("Q16. Você teve duas ou mais quedas no último ano?", answers.q16_falls, (b) =>
            setAnswers((prev) => ({ ...prev, q16_falls: b }))
          )}
        </View>
      );
    }

    if (key === "continencia") {
      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Continência (Q17)</Text>
          <View style={styles.qBox}>
            <Text style={styles.qText}>Q17. Você perde urina ou fezes, sem querer, em algum momento?</Text>
            <YesNo styles={styles} value={answers.q17_incontinence} onChange={(b) => setAnswers((prev) => ({ ...prev, q17_incontinence: b }))} />
          </View>
        </View>
      );
    }

    if (key === "comunicacao") {
      const q = (label: string, v: boolean | undefined, onChange: (b: boolean) => void, hint?: string) => (
        <View style={styles.qBox}>
          <Text style={styles.qText}>{label}</Text>
          {hint ? <Text style={styles.smallHint}>{hint}</Text> : null}
          <YesNo styles={styles} value={v} onChange={onChange} />
        </View>
      );

      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Comunicação (Q18–Q19)</Text>

          {q("Q18. Você tem problemas de visão capazes de impedir a realização de alguma atividade do cotidiano?", answers.q18_vision, (b) =>
            setAnswers((prev) => ({ ...prev, q18_vision: b })), "É permitido o uso de óculos ou lentes de contato."
          )}

          {q("Q19. Você tem problemas de audição capazes de impedir a realização de alguma atividade do cotidiano?", answers.q19_hearing, (b) =>
            setAnswers((prev) => ({ ...prev, q19_hearing: b })), "É permitido o uso de aparelhos de audição."
          )}
        </View>
      );
    }

    if (key === "comorbidades") {
      const none = !!answers.q20_none;

      const toggleNone = () => {
        setAnswers((prev) => ({
          ...prev,
          q20_none: !prev.q20_none,
          q20_chronic5: false,
          q20_meds5: false,
          q20_hosp6m: false,
        }));
      };

      const toggle = (k: "q20_chronic5" | "q20_meds5" | "q20_hosp6m") => {
        setAnswers((prev) => {
          const next = !prev[k];
          return { ...prev, q20_none: next ? false : prev.q20_none, [k]: next } as any;
        });
      };

      return (
        <View style={styles.card}>
          <Text style={styles.blockTitle}>Comorbidade múltipla (Q20)</Text>
          <Text style={styles.hintText}>Pontuação máxima da Q20: 4 pontos (se qualquer condição for positiva).</Text>

          <Checkbox styles={styles} checked={none} label="Nenhuma das opções abaixo" onToggle={toggleNone} />

          <View style={styles.divider} />

          <Checkbox styles={styles} checked={!!answers.q20_chronic5} label="Cinco ou mais doenças crônicas" onToggle={() => toggle("q20_chronic5")} disabled={none} />
          <Checkbox styles={styles} checked={!!answers.q20_meds5} label="Uso regular de cinco ou mais medicamentos diferentes, todo dia" onToggle={() => toggle("q20_meds5")} disabled={none} />
          <Checkbox styles={styles} checked={!!answers.q20_hosp6m} label="Internação recente, nos últimos seis meses" onToggle={() => toggle("q20_hosp6m")} disabled={none} />
        </View>
      );
    }

    return null;
  };

  const canFinish = blockIndex === blocks.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.card }} edges={["bottom"]}>
      <View style={styles.container}>
        {renderHeader()}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderBlock()}
          <AnswerError styles={styles} text={blockError} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.navBtn, blockIndex === 0 && styles.navBtnDisabled]} disabled={blockIndex === 0} onPress={goPrev}>
            <Text style={styles.navText}>Voltar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={goNext}>
            <Text style={[styles.navText, styles.navTextPrimary]}>{canFinish ? "Finalizar" : "Próximo bloco"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default IVCF20Screen;

function makeStyles(theme: any) {
  const COLORS = {
    primary: theme.colors.primary,
    page: theme.colors.card,
    surface: theme.colors.bg,
    text: theme.colors.text,
    muted: theme.colors.muted,
    border: theme.colors.border,
  };

  const SPACING = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 } as const;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.page },

    hero: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xl,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: "hidden",
    },
    heroPattern: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.25,
    },
    heroRingA: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      right: -90,
      top: -60,
    },
    heroRingB: {
      position: "absolute",
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      left: -60,
      bottom: -50,
    },
    heroDiag: {
      position: "absolute",
      width: 500,
      height: 2,
      backgroundColor: "#FFFFFF",
      top: 70,
      left: -120,
      transform: [{ rotate: "-12deg" }],
      opacity: 0.45,
    },

    heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    heroTitle: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 0.4 },
    heroSub: { marginTop: 10, color: "#fff", fontSize: 15, opacity: 0.95, fontWeight: "700" },
    heroHint: { marginTop: 6, color: "#fff", fontSize: 13, opacity: 0.9 },

    pill: {
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    pillText: { color: "#fff", fontWeight: "800", fontSize: 12 },

    scrollContent: {
      paddingBottom: 18,
      paddingTop: 0,
    },

    card: {
      marginHorizontal: SPACING.lg,
      marginTop: -18,
      backgroundColor: COLORS.surface,
      borderRadius: 18,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "light" ? 0.08 : 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },

    blockTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, marginBottom: SPACING.sm },
    subBlockTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text, marginBottom: SPACING.sm },

    hintText: { color: COLORS.muted, marginBottom: SPACING.md, lineHeight: 20 },
    smallHint: { color: COLORS.muted, marginTop: SPACING.xs, lineHeight: 19 },

    qBox: { marginTop: SPACING.md },
    qText: { color: COLORS.text, lineHeight: 22 },
    metaLine: { marginTop: 6, color: COLORS.muted },

    infoBox: {
      marginTop: SPACING.md,
      backgroundColor: theme.mode === "light" ? "#EEF4FF" : theme.colors.card,
      borderRadius: 14,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    infoText: { color: COLORS.muted, fontWeight: "700" },
    infoLine: { marginTop: 8, color: COLORS.muted, fontWeight: "700" },

    ynRow: { flexDirection: "row", gap: 10, marginTop: SPACING.sm },
    ynBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: theme.mode === "light" ? "#F7FAFF" : theme.colors.card,
    },
    ynBtnActive: { backgroundColor: COLORS.primary, borderColor: "rgba(255,255,255,0.35)" },
    ynText: { color: COLORS.text, fontWeight: "900" },
    ynTextActive: { color: "#fff" },

    radioRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: theme.mode === "light" ? "#F7FAFF" : theme.colors.card,
    },
    radioRowActive: { borderColor: COLORS.primary },
    dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.border },
    dotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
    radioText: { color: COLORS.text },
    radioTextActive: { color: COLORS.text, fontWeight: "900" },

    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 12,
      color: COLORS.text,
      backgroundColor: theme.mode === "light" ? "#F7FAFF" : theme.colors.card,
    },
    inputLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
    inlineInputs: { marginTop: 10, flexDirection: "row", gap: 12 },

    timer: { marginTop: SPACING.md, fontSize: 36, fontWeight: "900", color: COLORS.text },
    row: { flexDirection: "row", gap: 12, marginTop: SPACING.md },
    btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    btnStart: { backgroundColor: COLORS.primary },
    btnStop: { backgroundColor: "#E74C3C" },
    btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.border },
    btnText: { color: "#fff", fontWeight: "900" },
    btnGhostText: { color: COLORS.text },

    divider: { marginTop: SPACING.lg, height: 1, backgroundColor: COLORS.border },

    checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.mode === "light" ? "#F7FAFF" : theme.colors.card,
    },
    checkBoxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    checkMark: { color: "#fff", fontWeight: "900" },
    checkText: { color: COLORS.text, flex: 1, fontWeight: "700" },

    errorText: {
      marginHorizontal: SPACING.lg,
      marginTop: 12,
      marginBottom: SPACING.lg,
      color: "#E74C3C",
      fontWeight: "900",
    },

    footer: {
      flexDirection: "row",
      gap: 12,
      padding: SPACING.lg,
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    navBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: theme.mode === "light" ? "#F7FAFF" : theme.colors.card,
    },
    navBtnPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    navBtnDisabled: { opacity: 0.4 },
    navText: { color: COLORS.text, fontWeight: "900" },
    navTextPrimary: { color: "#fff" },
  });
}