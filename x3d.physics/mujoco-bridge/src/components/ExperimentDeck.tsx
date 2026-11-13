import { Btn } from "./ui";

const EXPERIMENTS = [
  {
    id:'contact-arm',number:'01',title:'Reach, then press',category:'CONTROL & CONTACT',color:'#79d9f4',
    question:'Why does an arm stop short of its target when an obstacle blocks the tip?',
    steps:['Open the arm. Feedback is enabled; use Restart experiment to begin at the home keyframe.', 'Measure 5 s and pin that run as the baseline. Select tip_touch or a joint angle in the saved-run chart.', 'Move a target slider or edit obstacle position in MJCF, Apply, and measure again. The cyan target marker shows the commanded end position; the orange obstacle constrains the actual motion.'],
    observe:'Compare tracking error, touch sensor, control saturation and the actual engine pose. A steady target error can be consistent with sustained contact.',
    boundary:'This example uses two horizontal hinges and contact only at the tip. It is not a full collision model of a physical robot or a force-control policy.',
  },
  {
    id: "ball-drop", number: "03", title: "Read the contact", category: "CONTACT & EVIDENCE", color: "#b9ef83",
    question: "What actually changes when a falling body meets a surface?",
    steps: ["Load the ball drop. Pause, reset, then advance individual physics steps near impact.", "Compare ball height, vertical velocity, contact count, and energy. Select individual telemetry series to keep scales readable.", "Change the ball's solref damping ratio, apply, and repeat from the same initial state."],
    observe: "A contact count alone cannot identify which bodies touched. The recovered ball checks identify the ball–floor pair.",
    boundary: "A visible rebound is one measured outcome; it is not a direct coefficient-of-restitution measurement.",
  },
  {
    id: "cartpole", number: "02", title: "Disturb the equilibrium", category: "CONTROL & CAUSALITY", color: "#79d9f4",
    question: "Can a controller recover from a disturbance, or does the test merely start at rest?",
    steps: ["Load the cartpole and inspect the slide motor's control limits.", "Run its challenge: the recovered check begins with a reproducible 0.08 rad pole displacement.", "Compare the final error with the maximum excursion over the whole run. A controller can end near the target after an unsafe excursion."],
    observe: "The bundled controller is a starting hypothesis. The measured check may fail; tune the model and controller against evidence.",
    boundary: "A hand-coded controller and a threshold check are not reinforcement-learning training.",
  },
  {
    id: "double-pendulum", number: "04", title: "Question the word chaos", category: "DYNAMICS & INFERENCE", color: "#c7b5ff",
    question: "What evidence distinguishes fast motion from sensitivity to initial conditions?",
    steps: ["Load the double pendulum and reset to the folded keyframe.", "Record a baseline run. Change one initial angle slightly and repeat with the same timestep and duration.", "Export each CSV and compare equal simulation times. Use matching timestamps and signal layouts to compare trajectories. A speed threshold alone is not a sensitivity analysis."],
    observe: "The current challenge checks release and speed. It does not establish a Lyapunov exponent or prove chaos.",
    boundary: "For a meaningful sensitivity experiment, keep the equations, solver, controls, and measurement procedure fixed.",
  },
  {
    id: "pendulum", number: "05", title: "Separate frames from steps", category: "NUMERICS & REPRODUCIBILITY", color: "#f3c178",
    question: "Does the simulation tell the same time when the display runs at a different refresh rate?",
    steps: ["Load the pendulum, choose the side keyframe, and compare 1× with slow motion.", "Use Step while paused: it advances exactly one model timestep.", "Inspect the observation JSON. Simulation time, effective timestep, and engine version travel with your data."],
    observe: "The repaired scheduler carries fractional timesteps across display frames. The source prototype rounded up every frame.",
    boundary: "Real-time catch-up is deliberately bounded. A suspended or overloaded tab can fall behind wall-clock time.",
  },
];

export default function ExperimentDeck({ onLoad }: { onLoad: (id: string) => void }) {
  return (
    <section className="space-y-5 pb-6">
      <div className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="mb-3 font-mono text-[10px] tracking-[.2em] text-lime-300">FIELD GUIDE / THREE CORE LABS + TWO EXTENSIONS</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Turn a moving scene<br />into an explanation.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">Predict an outcome. Change one thing. Observe the actual engine. Keep the evidence. These protocols connect the recovered teaching ideas to a real simulation.</p>
        </div>
        <div className="self-center rounded-xl border border-lime-300/20 bg-lime-300/5 p-5">
          <p className="text-xs font-semibold text-lime-200">Every measured run carries its contract.</p>
          <p className="mt-2 text-xs leading-6 text-slate-400">MJCF describes the physical model. MuJoCo owns its evolving state. The viewport explains it. The observation packet carries named bodies, explicit coordinate conventions, source XML, settings, and measurements.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[EXPERIMENTS[0],EXPERIMENTS[2],EXPERIMENTS[1],EXPERIMENTS[3],EXPERIMENTS[4]].map(experiment => (
          <article key={experiment.id} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/45 p-5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-light" style={{ color: experiment.color }}>{experiment.number}</span>
              <div><p className="font-mono text-[9px] tracking-[.16em] text-slate-500">{experiment.category}</p><h2 className="mt-1 text-lg font-semibold text-slate-100">{experiment.title}</h2></div>
            </div>
            <p className="my-4 text-sm leading-6 text-slate-300">{experiment.question}</p>
            <ol className="list-decimal space-y-2 pl-4 text-xs leading-6 text-slate-400">{experiment.steps.map(step => <li key={step}>{step}</li>)}</ol>
            <div className="mt-4 rounded-lg bg-slate-950/70 p-3 text-xs leading-6 text-slate-400"><span className="font-semibold text-slate-200">Look for evidence. </span>{experiment.observe}</div>
            <p className="my-3 text-[11px] leading-5 text-slate-500">{experiment.boundary}</p>
            <div className="mt-auto pt-2"><Btn variant="primary" onClick={() => onLoad(experiment.id)}>Open experiment ↗</Btn></div>
          </article>
        ))}
      </div>
    </section>
  );
}
