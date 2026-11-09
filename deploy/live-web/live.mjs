// Reads the deployed Punchcard contracts from the public Midnight preview indexer and decodes the ledger client-side.
import { ContractState } from "@midnight-ntwrk/compact-runtime";
import { ledger } from "../managed/contract/index.js";
import deployment from "../../docs/preview-deployment.json";
import gate from "../../docs/gate-e2e-preview.json";

const INDEXER = "https://indexer.preview.midnight.network/api/v4/graphql";
const CONTRACTS = [
  { title: "Contract A — full credit flow", address: deployment.address,
    note: "issue → redeem → double spend (rejected in-circuit) → redeem → self-serve buy() paying NIGHT → operator withdraw()." },
  { title: "Contract B — HTTP 402 paywall", address: gate.address,
    note: "An API server reads this ledger from the indexer: 402 → agent redeems on chain → 200 (two concurrent copies → one 200 + 409); thief without the claim 402; replay 403." },
];
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const Q = `query($a:HexEncoded!){contractAction(address:$a){__typename state transaction{hash block{height timestamp}}
  ... on ContractCall{entryPoint unshieldedBalances{tokenType amount}}}}`;

async function read(address) {
  const r = await fetch(INDEXER, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: Q, variables: { a: address } }) });
  const j = await r.json();
  if (j.errors || !j.data?.contractAction) throw new Error(j.errors?.[0]?.message ?? "contract not found");
  const a = j.data.contractAction;
  const l = ledger(ContractState.deserialize(fromHex(a.state)).data);
  return { a, l };
}

function render(c, { a, l }, i) {
  const nulls = [...l.spent].map(hex);
  const tickets = [...l.tickets].map(([k, v]) => [hex(k), hex(v)]);
  const bal = (a.unshieldedBalances ?? []).map((b) => `${b.amount} (token ${b.tokenType.slice(0, 8)}…${b.tokenType === "0".repeat(64) ? " = NIGHT" : ""})`).join(", ") || "0 NIGHT";
  return `<section id="c${i}"><h2>${esc(c.title)}</h2><p class="sub">${esc(c.note)}</p>
  <div class="kv">address ${c.address}<br>last action: <b>${esc(a.entryPoint ?? a.__typename)}</b> · block ${a.transaction.block.height}
  · ${new Date(a.transaction.block.timestamp).toISOString().replace(".000", "")}<br>tx hash ${a.transaction.hash}</div>
  <div class="row"><div><small>bundles issued</small><span class="big" data-k="bi">${l.bundlesIssued}</span></div>
  <div><small>credits redeemed</small><span class="big" data-k="cr">${l.creditsRedeemed}</span></div>
  <div><small>price / credit</small><span class="big">${l.pricePerCredit}</span></div>
  <div><small>contract balance</small><span class="big" style="font-size:16px">${esc(bal)}</span></div></div>
  <p class="sub">Bundle commitments: HistoricMerkleTree root (hiding — amounts and owners are inside the hash)</p>
  <div class="kv">${l.bundles.root().field?.toString(16) ?? "(empty)"}</div>
  <p class="sub">Spent nullifiers (${nulls.length}) → request ticket they paid for. Unlinkable to any bundle or buyer.</p>
  <div class="kv">${tickets.map(([k, v]) => `nf ${k}<br>&nbsp;→ ticket ${v}`).join("<br>") || "none"}</div>
  <p class="sub">Operator key (sealed at deploy): <code>${hex(l.operator)}</code></p></section>`;
}

const steps = () => `<section class="wide"><h2>Transactions of contract A (recorded by deploy/src/deploy.mjs)</h2><p class="sub">The live balance above (2000 paid by buy() − 1500 withdrawn = 500) is read from the indexer.</p>
  <table><tr><th>step</th><th>block</th><th>tx / result</th></tr>${deployment.steps.filter((s) => !("balance" in s)).map((s) => `<tr><td>${esc(s.step)}</td>
  <td>${s.block ?? ""}</td><td>${s.txId ? `<code>${s.txId}</code>` : `<span class="${/rejected/.test(s.result) ? "ok" : ""}">${esc(s.result ?? s.balance ?? "")}</span>`}</td></tr>`).join("")}</table>
  <h2 style="margin-top:14px">HTTP paywall run on contract B (deploy/src/gate-e2e.mjs)</h2>
  <table><tr><th>call</th><th>no ticket</th><th>redeem block</th><th>paid</th><th>concurrent copies</th><th>thief w/o claim</th><th>replay</th></tr>${gate.results.map((r) =>
  `<tr><td>${r.call}</td><td class="bad">${r.first}</td><td>${r.redeemBlock}</td><td class="ok">${r.paid}</td><td>${(r.concurrentCopies ?? []).join(" + ")}</td><td class="bad">${r.thiefWithoutClaim}</td><td class="bad">${r.replay}</td></tr>`).join("")}</table></section>`;

const checker = () => `<section class="wide"><h2>Check a nullifier yourself</h2>
  <p class="sub">Paste a 32-byte hex nullifier. The answer comes from the live ledger of contract A or B (Set.member) — this is exactly the check the API runs.</p>
  <input id="nf" placeholder="64 hex chars"><button id="chk">Is it spent?</button> <span id="ans"></span></section>`;

let state = [];
async function load() {
  const st = document.getElementById("status");
  try {
    state = await Promise.all(CONTRACTS.map((c) => read(c.address)));
    document.getElementById("main").innerHTML = CONTRACTS.map((c, i) => render(c, state[i], i)).join("") + checker() + steps();
    document.getElementById("chk").onclick = () => {
      const v = document.getElementById("nf").value.trim().toLowerCase().replace(/^0x/, "");
      const ans = document.getElementById("ans");
      if (!/^[0-9a-f]{64}$/.test(v)) { ans.innerHTML = `<span class="bad">need 64 hex chars</span>`; return; }
      const hit = state.map((s, i) => s.l.spent.member(fromHex(v)) ? "AB"[i] : null).filter(Boolean);
      ans.innerHTML = hit.length ? `<span class="ok">spent on contract ${hit.join(", ")}</span>` : `<span class="bad">not spent (unknown to both contracts)</span>`;
    };
    st.textContent = `live · read ${new Date().toLocaleTimeString()} · refreshes every 30 s`;
    st.dataset.ok = "1";
  } catch (e) {
    if (e.message === "contract not found") { showRecord(st); return; }
    st.innerHTML = `<span class="bad">indexer error: ${esc(e.message)}</span> (retrying)`;
  }
}
// The preview network was reset after these contracts were deployed: say so and show what was recorded at the time.
let recordShown = false;
function showRecord(st) {
  if (recordShown) return;
  recordShown = true;
  st.innerHTML = `<span class="bad">contracts not on the current preview chain</span>`;
  const rows = deployment.steps.filter((s) => s.block || s.result).map((s) => `<tr><td>${esc(s.step)}</td><td>${esc(s.block ?? s.result)}</td><td><code>${esc(s.txId ?? "")}</code></td></tr>`).join("");
  document.getElementById("main").innerHTML = `<section class="wide"><h2>What happened</h2>
    <p>Midnight's public preview network was reset around Nov 7, 2026 (block heights restarted) and now runs ledger 9.1. The contracts deployed on Nov 6 no longer exist there. This page can only read a contract that is on chain, so it now shows the record of the run instead of live state. The transactions below can no longer be looked up.</p>
    <p class="sub">The contract logic still runs in the <a href="../">interactive demo</a> (compiled contract on the local simulator).</p></section>
    <section class="wide"><h2>Recorded run, Nov 6, 2026 (contract ${esc(deployment.address)})</h2>
    <table><tr><th>Step</th><th>Block or result</th><th>Transaction</th></tr>${rows}</table></section>`;
}
load(); setInterval(() => { if (!document.activeElement || document.activeElement.id !== "nf") load(); }, 30000);
