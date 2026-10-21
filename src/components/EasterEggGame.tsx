import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Verstopt grapje: dubbelklik op het logo naast "Verkopen importeren" opent
// dit spelletje. Puur voor de lol, raakt geen bedrijfsdata of -logica aan.
// Canvas-tekening i.p.v. afbeeldingen, met kleuren die de tokens uit
// globals.css spiegelen (niet via CSS-variabelen uitgelezen, canvas-context
// kent die niet rechtstreeks).

const KLEUR = {
  lucht: "#f4f2ec", // --creme
  grond: "#e7e4db", // --zand
  grondlijn: "#cfc9ba",
  poppetje: "#15212b", // --navy / --ink
  dienblad: "#1f5fd0", // --accent
  vrachtwagen: "#1f5fd0", // --accent
  vrachtwagenRaam: "#f4f2ec",
  krat: "#a03c14", // --amber-text
  kratBand: "#f4f2ec",
  tekst: "#15212b",
};

const CANVAS_BREEDTE = 640;
const CANVAS_HOOGTE = 220;
const GROND_Y = CANVAS_HOOGTE - 36;
// De vrachtwagen blijft helemaal links staan en laat daar steeds een pakketje
// vallen; de speler staat rechts, pakketjes rollen van de wagen naar de
// speler toe (dus naar rechts) in plaats van andersom.
const VRACHTWAGEN_X = 18;
const VRACHTWAGEN_BREEDTE = 72;
const PAKKETJE_START_X = VRACHTWAGEN_X + VRACHTWAGEN_BREEDTE - 6;
const SPELER_X = CANVAS_BREEDTE - 140;
const SPELER_BREEDTE = 28;
const SPELER_HOOGTE = 38;
const ZWAARTEKRACHT = 2200; // px/s²
const SPRONG_SNELHEID = 760; // px/s
const START_SNELHEID = 260; // px/s, snelheid waarmee pakketjes naderen
const MAX_SNELHEID = 560;
const JOLT_DUUR = 180; // ms, kort bounce-effect op de wagen bij het laten vallen

interface Obstakel {
  x: number;
  breedte: number;
  hoogte: number;
}

type SpelStatus = "wachten" | "spelen" | "afgelopen";

function leesBesteScore(): number {
  try {
    return Number(window.localStorage.getItem("easter-egg-beste-score")) || 0;
  } catch {
    return 0;
  }
}

function schrijfBesteScore(score: number): void {
  try {
    window.localStorage.setItem("easter-egg-beste-score", String(score));
  } catch {
    // localStorage kan geblokkeerd zijn (privénavigatie e.d.) — niet kritiek,
    // het spel werkt dan gewoon zonder onthouden hoogste score.
  }
}

function TruckJumpGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<SpelStatus>("wachten");
  const [score, setScore] = useState(0);
  const [besteScore, setBesteScore] = useState(0);

  // Mutable spelstaat in refs — geen re-renders nodig op 60fps.
  const spelerY = useRef(0);
  const spelerVy = useRef(0);
  const springend = useRef(false);
  const snelheid = useRef(START_SNELHEID);
  const obstakels = useRef<Obstakel[]>([]);
  const volgendeSpawn = useRef(0);
  const joltTot = useRef(0);
  const afstand = useRef(0);
  const statusRef = useRef<SpelStatus>("wachten");
  const animatieFrame = useRef(0);
  const laatsteTijd = useRef(0);

  useEffect(() => {
    setBesteScore(leesBesteScore());
  }, []);

  function reset() {
    spelerY.current = 0;
    spelerVy.current = 0;
    springend.current = false;
    snelheid.current = START_SNELHEID;
    obstakels.current = [];
    volgendeSpawn.current = 600;
    joltTot.current = 0;
    afstand.current = 0;
    setScore(0);
  }

  function springen() {
    if (statusRef.current === "wachten") {
      starten();
      return;
    }
    if (statusRef.current === "afgelopen") {
      starten();
      return;
    }
    if (!springend.current) {
      springend.current = true;
      spelerVy.current = SPRONG_SNELHEID;
    }
  }

  function starten() {
    reset();
    statusRef.current = "spelen";
    setStatus("spelen");
  }

  function afgelopen() {
    statusRef.current = "afgelopen";
    setStatus("afgelopen");
    const eindScore = Math.floor(afstand.current / 10);
    if (eindScore > leesBesteScore()) {
      schrijfBesteScore(eindScore);
      setBesteScore(eindScore);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function tekenAchtergrond() {
      if (!ctx) return;
      ctx.fillStyle = KLEUR.lucht;
      ctx.fillRect(0, 0, CANVAS_BREEDTE, CANVAS_HOOGTE);
      ctx.fillStyle = KLEUR.grond;
      ctx.fillRect(0, GROND_Y, CANVAS_BREEDTE, CANVAS_HOOGTE - GROND_Y);
      ctx.strokeStyle = KLEUR.grondlijn;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROND_Y);
      ctx.lineTo(CANVAS_BREEDTE, GROND_Y);
      ctx.stroke();
    }

    function tekenSpeler() {
      if (!ctx) return;
      const y = GROND_Y - SPELER_HOOGTE - spelerY.current;
      // Lijf
      ctx.fillStyle = KLEUR.poppetje;
      ctx.beginPath();
      ctx.roundRect(SPELER_X, y + 10, SPELER_BREEDTE, SPELER_HOOGTE - 10, 6);
      ctx.fill();
      // Hoofd
      ctx.beginPath();
      ctx.arc(SPELER_X + SPELER_BREEDTE / 2, y + 6, 8, 0, Math.PI * 2);
      ctx.fill();
      // Dienblad (arm + blad), aan de kant van de aankomende pakketjes
      ctx.fillStyle = KLEUR.dienblad;
      ctx.fillRect(SPELER_X - 14, y + 14, 16, 3);
      ctx.beginPath();
      ctx.roundRect(SPELER_X - 14, y + 10, 4, 4, 1);
      ctx.fill();
    }

    function tekenVrachtwagen(tijd: number) {
      if (!ctx) return;
      // Korte "bounce" vlak na het laten vallen van een pakketje, puur voor
      // het gevoel dat de wagen net iets kwijtraakte.
      const nogJolt = Math.max(0, joltTot.current - tijd);
      const bounce = nogJolt > 0 ? Math.sin((nogJolt / JOLT_DUUR) * Math.PI) * 3 : 0;
      const y = GROND_Y - 26 - bounce;
      // Cabine links, laadbak rechts — de achterklep (waar de pakketjes uit
      // vallen) wijst dus naar de speler toe.
      ctx.fillStyle = KLEUR.vrachtwagen;
      ctx.beginPath();
      ctx.roundRect(VRACHTWAGEN_X, y + 6, 18, 20, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(VRACHTWAGEN_X + 18, y, 54, 26, 4);
      ctx.fill();
      ctx.fillStyle = KLEUR.vrachtwagenRaam;
      ctx.fillRect(VRACHTWAGEN_X + 5, y + 9, 9, 7);
      // Achterklep: duidelijke streep aan de rechterkant van de laadbak
      ctx.strokeStyle = KLEUR.vrachtwagenRaam;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(VRACHTWAGEN_X + VRACHTWAGEN_BREEDTE - 3, y + 3);
      ctx.lineTo(VRACHTWAGEN_X + VRACHTWAGEN_BREEDTE - 3, y + 23);
      ctx.stroke();
      ctx.fillStyle = KLEUR.poppetje;
      ctx.beginPath();
      ctx.arc(VRACHTWAGEN_X + 4, y + 26, 5, 0, Math.PI * 2);
      ctx.arc(VRACHTWAGEN_X + 28, y + 26, 5, 0, Math.PI * 2);
      ctx.arc(VRACHTWAGEN_X + 58, y + 26, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    function tekenObstakel(o: Obstakel) {
      if (!ctx) return;
      const y = GROND_Y - o.hoogte;
      ctx.fillStyle = KLEUR.krat;
      ctx.beginPath();
      ctx.roundRect(o.x, y, o.breedte, o.hoogte, 3);
      ctx.fill();
      ctx.strokeStyle = KLEUR.kratBand;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.x, y + o.hoogte / 2);
      ctx.lineTo(o.x + o.breedte, y + o.hoogte / 2);
      ctx.stroke();
    }

    function botsing(o: Obstakel): boolean {
      const spelerBovenY = GROND_Y - SPELER_HOOGTE - spelerY.current;
      const obstakelBovenY = GROND_Y - o.hoogte;
      const overlapX = SPELER_X + SPELER_BREEDTE > o.x && SPELER_X < o.x + o.breedte;
      const overlapY = spelerBovenY + SPELER_HOOGTE > obstakelBovenY;
      return overlapX && overlapY;
    }

    function frame(tijd: number) {
      if (!ctx) return;
      const delta = laatsteTijd.current ? Math.min((tijd - laatsteTijd.current) / 1000, 0.05) : 0;
      laatsteTijd.current = tijd;

      tekenAchtergrond();

      if (statusRef.current === "spelen") {
        // Fysica speler — spelerY is hoogte boven de grond (0 = op de grond,
        // positief = in de lucht); zwaartekracht trekt de verticale snelheid
        // omlaag, een sprong zet 'm met een positieve snelheid omhoog.
        spelerVy.current -= ZWAARTEKRACHT * delta;
        spelerY.current += spelerVy.current * delta;
        if (spelerY.current < 0) {
          spelerY.current = 0;
          spelerVy.current = 0;
          springend.current = false;
        }

        snelheid.current = Math.min(MAX_SNELHEID, START_SNELHEID + afstand.current / 20);
        afstand.current += snelheid.current * delta;
        setScore(Math.floor(afstand.current / 10));

        // De wagen staat vast links en laat er met tussenpozen een pakketje
        // vallen, dat vervolgens naar rechts (richting de speler) rolt.
        volgendeSpawn.current -= snelheid.current * delta;
        if (volgendeSpawn.current <= 0) {
          obstakels.current.push({
            x: PAKKETJE_START_X,
            breedte: 20 + Math.random() * 10,
            hoogte: 20 + Math.random() * 14,
          });
          joltTot.current = tijd + JOLT_DUUR;
          volgendeSpawn.current = 260 + Math.random() * 260;
        }

        for (const o of obstakels.current) {
          o.x += snelheid.current * delta;
        }
        obstakels.current = obstakels.current.filter((o) => o.x < CANVAS_BREEDTE + 40);

        for (const o of obstakels.current) {
          if (botsing(o)) {
            afgelopen();
            break;
          }
        }
      }

      tekenVrachtwagen(tijd);
      for (const o of obstakels.current) tekenObstakel(o);
      tekenSpeler();

      ctx.fillStyle = KLEUR.tekst;
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`Score: ${Math.floor(afstand.current / 10)}`, CANVAS_BREEDTE - 14, 24);

      animatieFrame.current = requestAnimationFrame(frame);
    }

    animatieFrame.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animatieFrame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function toetsAf(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        springen();
      }
    }
    window.addEventListener("keydown", toetsAf);
    return () => window.removeEventListener("keydown", toetsAf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_BREEDTE}
          height={CANVAS_HOOGTE}
          onClick={springen}
          className="motion w-full max-w-[640px] cursor-pointer rounded-[12px] border border-border-light"
        />
        {status !== "spelen" && (
          <button
            type="button"
            onClick={springen}
            className="motion absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[12px] bg-ink/40 text-creme"
          >
            <span className="display text-[20px]">
              {status === "wachten" ? "Spring over de gevallen spullen!" : "Game over"}
            </span>
            {status === "afgelopen" && (
              <span className="text-[13px]">Score: {score} · Beste: {besteScore}</span>
            )}
            <span className="kicker mt-1 rounded-[999px] bg-accent px-4 py-2 text-[11px] text-accent-on">
              {status === "wachten" ? "Klik of druk op spatie" : "Opnieuw proberen"}
            </span>
          </button>
        )}
      </div>
      <p className="text-[12px] text-text-muted">Spatie / pijltje omhoog / klikken om te springen</p>
    </div>
  );
}

export function EasterEggLogo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onDoubleClick={() => setOpen(true)}
        aria-label="Verstopt spelletje"
        title=""
        className="motion flex h-8 w-8 shrink-0 items-center justify-center rounded-[999px] text-ink/70 hover:bg-zand"
      >
        <img src="/logo-ov-mark.svg" alt="" width={22} height={22} className="pointer-events-none" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-ink/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-[680px] flex-col gap-3 rounded-[18px] bg-white p-5 shadow-[var(--shadow-hover)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="display text-[18px] text-ink">Dienblad-dash</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="motion flex h-8 w-8 shrink-0 items-center justify-center rounded-[999px] text-text-muted hover:bg-zand"
                aria-label="Sluiten"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <TruckJumpGame />
          </div>
        </div>
      )}
    </>
  );
}
