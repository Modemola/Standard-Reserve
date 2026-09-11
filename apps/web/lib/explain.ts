/**
 * Plain-language glossary.
 *
 * User testing said the build was hard to read for anyone who does not
 * already know this vocabulary, which is most people. Every jargon term and
 * every consequential button now carries one of these, surfaced by
 * `components/Explain.tsx`.
 *
 * House rules for the copy, so later entries stay consistent with these:
 *
 *   - `plain` answers "what is this?" in one sentence a stranger could read
 *     aloud and understand. No symbols, no other jargon, no cross-references.
 *   - `more` is the second layer: how it works, or what pressing it will do.
 *     Two or three sentences at most.
 *   - `note` is for the thing people get wrong, and is left off when there
 *     isn't one. It is not a place for extra detail.
 *   - Never explain a term using another term that is itself in here. If that
 *     feels impossible, the sentence is still too technical.
 *   - Numbers are concrete. "0.30%" beats "a small fee".
 */

export interface ExplainEntry {
  /** Heading of the panel — the human name, not the symbol. */
  term: string;
  /** One sentence. What is this? */
  plain: string;
  /** How it works, or what the button will do. */
  more?: string;
  /** The common misunderstanding. Omit when there isn't one. */
  note?: string;
}

export const EXPLAIN: Record<string, ExplainEntry> = {
  // --- The clock -----------------------------------------------------------
  epoch: {
    term: "Epoch",
    plain: "One accounting day. At the end of it, the protocol adds everything up and decides what to do next.",
    more: "Nothing about policy changes in the middle of an epoch. Trades happen continuously, but the decisions — how much new money to allow, where fees go — all land at the close.",
  },
  tick: {
    term: "Advance the clock",
    plain: "Moves simulated time forward. Nothing happens on its own until you do.",
    more: "This is a simulation, so there is no real clock running. An hour or a day only passes because you moved it.",
    note: "Only 'close the epoch' reaches the end of an accounting day, which is the moment policy actually updates.",
  },
  closeEpoch: {
    term: "Close the epoch",
    plain: "Jumps to the end of the current accounting day and lets the protocol make its decisions.",
    more: "It totals the money that came in and went out, picks the mode for the next day, routes the fee income, and adjusts how much new money is allowed.",
  },
  heartbeat: {
    term: "Heartbeat",
    plain: "How long it has been since this bank last showed it was still active.",
    more: "Banks are expected to check in regularly. The longer this runs, the closer the bank gets to being reported as abandoned.",
  },

  // --- Flow and mode -------------------------------------------------------
  netFlow: {
    term: "Net flow this epoch",
    plain: "Money that came in, minus money that went out, so far today.",
    more: "If more value arrived than left, this is a positive number. It is the single figure the protocol watches most closely.",
    note: "Only whether it ends up above or below zero matters. A huge inflow and a tiny one count exactly the same.",
  },
  signal: {
    term: "Signal",
    plain: "The last two finished days added together.",
    more: "The protocol looks at a pair of days rather than only the most recent one, so a single strange day cannot swing policy on its own.",
  },
  regime: {
    term: "Mode",
    plain: "Whether money flowed in on the last finished day, or did not.",
    more: "Money in means expansion: the protocol is willing to create more. Money out means contraction: it pulls back and starts buying its own currency off the market.",
    note: "The dividing line is exactly zero. A day that ends perfectly even counts as contraction, not expansion.",
  },
  expansion: {
    term: "Expansion",
    plain: "The mode the protocol is in when money flowed in.",
    more: "New currency is allowed to be created, and the day's fee income is set aside in the expansion reserve.",
  },
  contraction: {
    term: "Contraction",
    plain: "The mode the protocol is in when money did not flow in.",
    more: "Creation of new currency is cut back, and every hour the protocol spends some of its reserve buying its own currency off the market and destroying it.",
  },

  // --- Issuance ------------------------------------------------------------
  multiplier: {
    term: "Issuance multiplier",
    plain: "How generous the protocol is currently being about creating new currency.",
    more: "It moves between 0.20 at its most cautious and 1.25 at its most generous. Two good days in a row raise it by 0.05. One bad day cuts it by 0.25.",
    note: "A cut is five times bigger than a raise, so ground is lost far faster than it is gained. That asymmetry is deliberate.",
  },
  atCeiling: {
    term: "At the ceiling",
    plain: "The protocol is already being as generous as its rules allow, and cannot go higher.",
  },
  atFloor: {
    term: "At the floor",
    plain: "The protocol is already being as cautious as its rules allow, and cannot go lower.",
  },
  budgetUsed: {
    term: "Budget used",
    plain: "How much of today's allowance for new currency has already been claimed.",
    more: "Each day has a cap. Once it is used up, no more can be created until the next day begins, no matter who asks.",
  },

  // --- Supply --------------------------------------------------------------
  sCirc: {
    term: "Currency in circulation",
    plain: "How much of the currency is in people's hands right now.",
    more: "It rises when new currency is created and falls when currency is destroyed.",
  },
  sMax: {
    term: "Maximum possible supply",
    plain: "The most currency that could ever exist. It only ever goes down.",
    more: "It starts at a fixed cap and drops every time currency is destroyed, because destroyed currency can never be recreated.",
    note: "This is a ceiling, not a balance. It is almost always far above what is actually in circulation.",
  },
  minted: {
    term: "Created",
    plain: "The running total of all currency ever created here.",
  },
  burned: {
    term: "Destroyed",
    plain: "The running total of all currency permanently removed from existence.",
    more: "Destroying is one-way. Nothing brings it back, which is why the maximum possible supply falls whenever it happens.",
  },
  totalLedger: {
    term: "Total on the books",
    plain: "Everything every open branch is holding, added together.",
  },

  // --- Reserves and liquidity ---------------------------------------------
  pol: {
    term: "Protocol-owned liquidity",
    plain: "The trading pool the protocol owns outright, instead of borrowing it from outside investors.",
    more: "Most projects rent their trading pool from people who can withdraw at any moment. Because this one owns its pool, nobody can pull the floor out from under the market.",
  },
  expansionVault: {
    term: "Expansion reserve",
    plain: "Where fee income is kept when a day ends with money flowing in.",
  },
  contractionVault: {
    term: "Contraction reserve",
    plain: "Where fee income is kept when a day ends with money flowing out.",
    more: "This is the money the protocol spends buying its own currency back off the market during a downturn.",
  },
  buyback: {
    term: "Buyback",
    plain: "During a downturn, the protocol spends its reserve each hour buying its own currency and destroying it.",
    more: "It is deliberately limited so it cannot drain itself or overwhelm the market: at most a tenth of the reserve, and never more than a small slice of the pool.",
  },
  expansionGold: {
    term: "Gold column",
    plain: "A placeholder. Nothing is behind it yet.",
    more: "The design leaves room for converting reserves into gold, but this version does not do it, so this figure never moves off zero.",
    note: "Do not read it as a gold reserve. It is an unfinished idea shown honestly rather than hidden.",
  },

  // --- Trading -------------------------------------------------------------
  buyStd: {
    term: "Buy currency",
    plain: "Spends ETH to get currency out of the pool — the same as a swap on any exchange.",
    more: "This counts as money flowing in, so it pushes today toward expansion. A fee of 0.30% is taken on the way through.",
    note: "The price moves as you buy. Large orders get a noticeably worse rate than small ones.",
  },
  sellStd: {
    term: "Sell currency",
    plain: "Returns currency to the pool and takes ETH back out.",
    more: "This counts as money flowing out, pushing today toward contraction. The same 0.30% fee applies.",
  },
  spotPrice: {
    term: "Price",
    plain: "What one unit of currency is worth in ETH right now, based on what is in the pool.",
    more: "It is not set by anyone. It is simply the ratio of the two sides of the pool, and it shifts with every trade.",
  },
  poolTape: {
    term: "Trade tape",
    plain: "A running list of what has just happened, newest at the top.",
  },

  // --- Banks ---------------------------------------------------------------
  charter: {
    term: "Charter",
    plain: "Permission to run a bank inside this system.",
    more: "Charters are sold at auction, and each one can open a limited number of branches.",
  },
  branch: {
    term: "Branch",
    plain: "One outlet belonging to a bank.",
    more: "Each branch keeps its own books, and can be closed independently of the others.",
  },
  license: {
    term: "Licence",
    plain: "A permit that lets a branch create new currency.",
    more: "They are sold daily by auction, and there is a hard limit on how many a single bank can buy in a day.",
  },
  dutchAuction: {
    term: "Falling-price auction",
    plain: "The price starts high in the morning and falls all day until somebody buys.",
    more: "Waiting gets you a better price. The risk is that somebody else buys first, and then the chance is gone until tomorrow.",
  },
  floorPrice: {
    term: "Floor price",
    plain: "The lowest the price can fall to, reached at the end of the day.",
  },
  retire: {
    term: "Close a branch",
    plain: "Shuts a branch down and pays out what it was holding.",
    more: "A fee is taken, and the fee grows the more people are heading for the exit at the same time.",
    note: "This cannot be undone. The branch does not reopen.",
  },
  checkIn: {
    term: "Check in",
    plain: "Shows the bank is still being looked after.",
    more: "Banks that go quiet for long enough can be reported by anyone and shut down, so this resets the clock.",
  },
  reportDormant: {
    term: "Report an abandoned bank",
    plain: "Flags a bank that has stopped checking in.",
    more: "If the bank really has gone quiet for long enough, you are paid a reward for spotting it. If it has not, nothing happens and nothing is lost.",
  },
  exitFee: {
    term: "Exit fee",
    plain: "What it costs to take your money out.",
    more: "It is low when few people are leaving and high when many are. Leaving calmly is cheap; joining a stampede is not.",
  },
  crowd: {
    term: "Crowd at the exit",
    plain: "How much everyone else is trying to withdraw at the same time as you.",
    more: "Drag this to see what your own exit would cost if a rush started. Your real position is untouched.",
  },

  // --- The Desk ------------------------------------------------------------
  flip: {
    term: "Cost to flip the day",
    plain: "How much ETH it would take, right now, to turn today from money-out into money-in.",
    more: "Because the protocol only checks whether the day ends above or below zero, this is often a much smaller number than people expect.",
  },
  licensePlans: {
    term: "Three ways to buy",
    plain: "The same permit, bought now, bought later today, or bought at the day's lowest price.",
    more: "Each row shows what you would pay and what you would be giving up by waiting.",
  },
  charterBoard: {
    term: "Charters for sale",
    plain: "Banks currently available to buy.",
    note: "When the sale is closed there is no price shown at all, because there is genuinely nothing to buy.",
  },

  // --- Sentinel ------------------------------------------------------------
  sentinel: {
    term: "Attack tests",
    plain: "Scripted attempts to cheat the protocol, replayed against the real rules to see whether they hold.",
    more: "Each one is a specific trick somebody might try. The result says whether the rules stopped it.",
  },
  verdictHeld: {
    term: "Held",
    plain: "The rules stopped it. The attack found no cheaper way through.",
  },
  verdictCheap: {
    term: "Cheap",
    plain: "The rules worked exactly as written, but doing this costs less than you would expect.",
    more: "This is a finding worth knowing about, not a failure. Nothing is broken.",
  },
  verdictBroken: {
    term: "Broken",
    plain: "Something that should always be true was not. This is a real fault.",
  },
  replayInLab: {
    term: "Replay in the Lab",
    plain: "Loads the world exactly as the attack left it, so you can poke at the aftermath yourself.",
  },

  // --- Tools ---------------------------------------------------------------
  whatIf: {
    term: "What-if drawer",
    plain: "Try a change and see the result before you commit to it.",
    more: "Everything here is a preview. The live simulation is not touched until you press commit.",
  },
  scenario: {
    term: "Scenario",
    plain: "A saved sequence of events you can replay to watch how the protocol responds.",
  },
  sweep: {
    term: "Sweep",
    plain: "Runs the same story over and over while changing one setting, to show the shape of the result.",
    more: "It answers 'what does this dial actually do?' better than any single run can.",
  },
  exportWorld: {
    term: "Export",
    plain: "Downloads the exact state of this simulation as a file.",
  },
  charterDailyCap: {
    term: "Charters sold per day",
    plain: "How many banks can be sold each day. Zero closes the sale entirely.",
  },
  genesisCharters: {
    term: "Starting banks",
    plain: "How many banks to create when the simulation begins.",
  },
  params: {
    term: "Constants",
    plain: "Every fixed number the protocol runs on, in one place.",
    more: "Nothing is hidden in the code. Every figure the rules depend on is listed here and can be traced to where it is used.",
  },
};

export type ExplainKey = keyof typeof EXPLAIN;
